/**
 * Database Connection Service
 * 
 * Handles database connection management, testing, and secure credential storage
 */

import { db } from "@/lib/db";
import { connections } from "@/lib/db/schema";
import { encrypt, decrypt } from "@/lib/encryption";
import { eq, and, isNull } from "drizzle-orm";
import { Client as PgClient } from "pg";
import mysql from "mysql2/promise";
import Database from "better-sqlite3";

export interface ConnectionConfig {
  type: "postgres" | "mysql" | "mssql" | "sqlite";
  name: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  connectionString?: string;
  ssl?: boolean;
  sslConfig?: any;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  details?: {
    version?: string;
    serverInfo?: any;
    error?: string;
  };
}

/**
 * Create a new database connection
 */
export async function createConnection(
  workspaceId: string,
  userId: string,
  config: ConnectionConfig
): Promise<string> {
  try {
    // Encrypt sensitive credentials
    const encryptedCreds: any = {};
    
    if (config.password) {
      encryptedCreds.password = await encrypt(config.password);
    }
    
    if (config.connectionString) {
      encryptedCreds.connectionString = await encrypt(config.connectionString);
    }

    // Store connection in database
    const [connection] = await db
      .insert(connections)
      .values({
        workspaceId,
        name: config.name,
        type: config.type as any,
        host: config.host,
        port: config.port,
        database: config.database,
        username: config.username,
        encryptedCredentials: JSON.stringify(encryptedCreds),
        sslConfig: config.sslConfig || {},
        createdById: userId,
        isActive: true,
      })
      .returning({ id: connections.id });

    return connection.id;
  } catch (error: any) {
    console.error("Failed to create connection:", error);
    throw new Error(`Failed to create connection: ${error.message}`);
  }
}

/**
 * Update an existing database connection
 */
export async function updateConnection(
  connectionId: string,
  userId: string,
  config: Partial<ConnectionConfig>
): Promise<void> {
  try {
    const updates: any = {};

    // Update basic fields
    if (config.name !== undefined) updates.name = config.name;
    if (config.host !== undefined) updates.host = config.host;
    if (config.port !== undefined) updates.port = config.port;
    if (config.database !== undefined) updates.database = config.database;
    if (config.username !== undefined) updates.username = config.username;
    if (config.ssl !== undefined) updates.ssl = config.ssl;
    if (config.sslConfig !== undefined) updates.sslConfig = config.sslConfig;

    // Handle encrypted credentials
    if (config.password !== undefined || config.connectionString !== undefined) {
      const encryptedCreds: any = {};
      
      if (config.password) {
        encryptedCreds.password = await encrypt(config.password);
      }
      
      if (config.connectionString) {
        encryptedCreds.connectionString = await encrypt(config.connectionString);
      }
      
      updates.encryptedCredentials = JSON.stringify(encryptedCreds);
    }

    updates.updatedAt = new Date();

    await db
      .update(connections)
      .set(updates)
      .where(eq(connections.id, connectionId));
  } catch (error: any) {
    console.error("Failed to update connection:", error);
    throw new Error(`Failed to update connection: ${error.message}`);
  }
}

/**
 * Get decrypted connection configuration
 */
export async function getConnectionConfig(connectionId: string): Promise<ConnectionConfig> {
  try {
    const [connection] = await db
      .select()
      .from(connections)
      .where(and(eq(connections.id, connectionId), isNull(connections.deletedAt)))
      .limit(1);

    if (!connection) {
      throw new Error("Connection not found");
    }

    // Decrypt credentials
    let decryptedPassword: string | undefined;
    let decryptedConnectionString: string | undefined;

    if (connection.encryptedCredentials) {
      try {
        const encryptedCreds = JSON.parse(connection.encryptedCredentials);
        
        if (encryptedCreds.password) {
          decryptedPassword = await decrypt(encryptedCreds.password);
        }
        
        if (encryptedCreds.connectionString) {
          decryptedConnectionString = await decrypt(encryptedCreds.connectionString);
        }
      } catch (error) {
        console.error("Failed to decrypt credentials:", error);
      }
    }

    return {
      type: connection.type as any,
      name: connection.name,
      host: connection.host || undefined,
      port: connection.port || undefined,
      database: connection.database || undefined,
      username: connection.username || undefined,
      password: decryptedPassword,
      connectionString: decryptedConnectionString,
      ssl: connection.sslConfig?.enabled || false,
      sslConfig: connection.sslConfig as any,
    };
  } catch (error: any) {
    console.error("Failed to get connection config:", error);
    throw new Error(`Failed to get connection config: ${error.message}`);
  }
}

/**
 * Test a database connection
 */
export async function testConnection(
  config: ConnectionConfig
): Promise<TestConnectionResult> {
  try {
    switch (config.type) {
      case "postgres":
        return await testPostgresConnection(config);
      case "mysql":
        return await testMysqlConnection(config);
      case "sqlite":
        return await testSqliteConnection(config);
      default:
        return {
          success: false,
          message: `Unsupported database type: ${config.type}`,
        };
    }
  } catch (error: any) {
    return {
      success: false,
      message: "Connection test failed",
      details: {
        error: error.message,
      },
    };
  }
}

/**
 * Test PostgreSQL connection
 */
async function testPostgresConnection(config: ConnectionConfig): Promise<TestConnectionResult> {
  let client: PgClient | null = null;
  
  try {
    // Build connection config
    const pgConfig: any = config.connectionString
      ? { connectionString: config.connectionString }
      : {
          host: config.host,
          port: config.port,
          database: config.database,
          user: config.username,
          password: config.password,
          ssl: config.ssl ? (config.sslConfig || { rejectUnauthorized: false }) : false,
        };

    // Create and connect client
    client = new PgClient(pgConfig);
    await client.connect();

    // Get version info
    const result = await client.query("SELECT version() as version, current_database() as database");
    const version = result.rows[0]?.version;

    return {
      success: true,
      message: "Connection successful",
      details: {
        version,
        serverInfo: {
          database: result.rows[0]?.database,
        },
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: "PostgreSQL connection failed",
      details: {
        error: error.message,
      },
    };
  } finally {
    if (client) {
      await client.end();
    }
  }
}

/**
 * Test MySQL connection
 */
async function testMysqlConnection(config: ConnectionConfig): Promise<TestConnectionResult> {
  let connection: mysql.Connection | null = null;
  
  try {
    // Build connection config
    const mysqlConfig: any = config.connectionString
      ? { uri: config.connectionString }
      : {
          host: config.host,
          port: config.port,
          database: config.database,
          user: config.username,
          password: config.password,
          ssl: config.ssl ? config.sslConfig : undefined,
        };

    // Create connection
    connection = await mysql.createConnection(mysqlConfig);

    // Get version info
    const [rows] = await connection.execute("SELECT VERSION() as version, DATABASE() as db");
    const version = (rows as any)[0]?.version;

    return {
      success: true,
      message: "Connection successful",
      details: {
        version,
        serverInfo: {
          database: (rows as any)[0]?.db,
        },
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: "MySQL connection failed",
      details: {
        error: error.message,
      },
    };
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

/**
 * Test SQLite connection
 */
async function testSqliteConnection(config: ConnectionConfig): Promise<TestConnectionResult> {
  let db: Database.Database | null = null;
  
  try {
    // SQLite uses file path as database
    const dbPath = config.database || ":memory:";
    
    // Open database
    db = new Database(dbPath, { readonly: true });
    
    // Get version info
    const version = db.prepare("SELECT sqlite_version() as version").get() as any;

    return {
      success: true,
      message: "Connection successful",
      details: {
        version: version?.version,
        serverInfo: {
          file: dbPath,
        },
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: "SQLite connection failed",
      details: {
        error: error.message,
      },
    };
  } finally {
    if (db) {
      db.close();
    }
  }
}

/**
 * Delete a connection (soft delete)
 */
export async function deleteConnection(connectionId: string): Promise<void> {
  try {
    await db
      .update(connections)
      .set({
        deletedAt: new Date(),
        isActive: false,
      })
      .where(eq(connections.id, connectionId));
  } catch (error: any) {
    console.error("Failed to delete connection:", error);
    throw new Error(`Failed to delete connection: ${error.message}`);
  }
}

/**
 * Store connection test result
 */
export async function updateConnectionTestResult(
  connectionId: string,
  result: TestConnectionResult
): Promise<void> {
  try {
    await db
      .update(connections)
      .set({
        lastConnectedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(connections.id, connectionId));
  } catch (error: any) {
    console.error("Failed to update connection test result:", error);
  }
}