/**
 * Database Connection Testing Utilities
 * 
 * Tests database connections before saving them
 */

import { Client as PgClient } from "pg";
import mysql from "mysql2/promise";
import { ConnectionOptions } from "tedious";
import Database from "better-sqlite3";

interface ConnectionConfig {
  type: "postgres" | "mysql" | "mssql" | "sqlite";
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
  sslConfig?: {
    enabled: boolean;
    rejectUnauthorized?: boolean;
    ca?: string;
    cert?: string;
    key?: string;
  };
}

interface TestResult {
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Test a database connection
 */
export async function testDatabaseConnection(
  config: ConnectionConfig
): Promise<TestResult> {
  try {
    switch (config.type) {
      case "postgres":
        return await testPostgresConnection(config);
      case "mysql":
        return await testMysqlConnection(config);
      case "mssql":
        return await testMssqlConnection(config);
      case "sqlite":
        return await testSqliteConnection(config);
      default:
        return {
          success: false,
          error: `Unsupported database type: ${config.type}`,
        };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Connection test failed",
    };
  }
}

/**
 * Test PostgreSQL connection
 */
async function testPostgresConnection(
  config: ConnectionConfig
): Promise<TestResult> {
  const client = new PgClient({
    host: config.host,
    port: config.port || 5432,
    database: config.database,
    user: config.username,
    password: config.password,
    ssl: config.sslConfig?.enabled
      ? {
          rejectUnauthorized: config.sslConfig.rejectUnauthorized ?? true,
          ca: config.sslConfig.ca,
          cert: config.sslConfig.cert,
          key: config.sslConfig.key,
        }
      : false,
    connectionTimeoutMillis: 10000,
    query_timeout: 5000,
  });

  try {
    await client.connect();
    
    // Get server version and other metadata
    const versionResult = await client.query("SELECT version()");
    const dbSizeResult = await client.query(
      "SELECT pg_database_size($1) as size",
      [config.database]
    );
    const tablesResult = await client.query(
      "SELECT count(*) as count FROM information_schema.tables WHERE table_schema = 'public'"
    );

    await client.end();

    return {
      success: true,
      metadata: {
        version: versionResult.rows[0]?.version,
        databaseSize: dbSizeResult.rows[0]?.size,
        tableCount: parseInt(tablesResult.rows[0]?.count || "0"),
        connectionTime: new Date().toISOString(),
      },
    };
  } catch (error: any) {
    await client.end().catch(() => {});
    return {
      success: false,
      error: `PostgreSQL connection failed: ${error.message}`,
    };
  }
}

/**
 * Test MySQL connection
 */
async function testMysqlConnection(
  config: ConnectionConfig
): Promise<TestResult> {
  try {
    const connection = await mysql.createConnection({
      host: config.host,
      port: config.port || 3306,
      database: config.database,
      user: config.username,
      password: config.password,
      ssl: config.sslConfig?.enabled
        ? {
            rejectUnauthorized: config.sslConfig.rejectUnauthorized ?? true,
            ca: config.sslConfig.ca,
            cert: config.sslConfig.cert,
            key: config.sslConfig.key,
          }
        : undefined,
      connectTimeout: 10000,
    });

    // Get server version and metadata
    const [versionRows]: any = await connection.execute("SELECT VERSION() as version");
    const [tablesRows]: any = await connection.execute(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ?",
      [config.database]
    );

    await connection.end();

    return {
      success: true,
      metadata: {
        version: versionRows[0]?.version,
        tableCount: parseInt(tablesRows[0]?.count || "0"),
        connectionTime: new Date().toISOString(),
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: `MySQL connection failed: ${error.message}`,
    };
  }
}

/**
 * Test Microsoft SQL Server connection
 */
async function testMssqlConnection(
  config: ConnectionConfig
): Promise<TestResult> {
  // For MSSQL, we'll use a simple approach
  // In production, you'd use the tedious library
  try {
    // This is a placeholder - implement actual MSSQL connection test
    // using tedious or mssql package
    return {
      success: false,
      error: "MSSQL connection testing not yet implemented",
    };
  } catch (error: any) {
    return {
      success: false,
      error: `MSSQL connection failed: ${error.message}`,
    };
  }
}

/**
 * Test SQLite connection
 */
async function testSqliteConnection(
  config: ConnectionConfig
): Promise<TestResult> {
  try {
    // For SQLite, the database path is the "database" field
    const db = new Database(config.database, {
      readonly: false,
      timeout: 5000,
    });

    // Test the connection with a simple query
    const versionInfo = db.prepare("SELECT sqlite_version() as version").get() as any;
    const tableCount = db
      .prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'")
      .get() as any;

    db.close();

    return {
      success: true,
      metadata: {
        version: versionInfo?.version,
        tableCount: parseInt(tableCount?.count || "0"),
        connectionTime: new Date().toISOString(),
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: `SQLite connection failed: ${error.message}`,
    };
  }
}

/**
 * Get database schema information
 */
export async function getDatabaseSchema(
  config: ConnectionConfig
): Promise<any> {
  switch (config.type) {
    case "postgres":
      return await getPostgresSchema(config);
    case "mysql":
      return await getMysqlSchema(config);
    default:
      throw new Error(`Schema extraction not supported for ${config.type}`);
  }
}

/**
 * Get PostgreSQL schema
 */
async function getPostgresSchema(config: ConnectionConfig): Promise<any> {
  const client = new PgClient({
    host: config.host,
    port: config.port || 5432,
    database: config.database,
    user: config.username,
    password: config.password,
    ssl: config.sslConfig?.enabled
      ? {
          rejectUnauthorized: config.sslConfig.rejectUnauthorized ?? true,
          ca: config.sslConfig.ca,
          cert: config.sslConfig.cert,
          key: config.sslConfig.key,
        }
      : false,
  });

  try {
    await client.connect();

    const tablesQuery = `
      SELECT 
        table_name,
        table_schema
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name
    `;

    const columnsQuery = `
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_name, ordinal_position
    `;

    const [tables, columns] = await Promise.all([
      client.query(tablesQuery),
      client.query(columnsQuery),
    ]);

    await client.end();

    // Group columns by table
    const schema: Record<string, any> = {};
    
    for (const table of tables.rows) {
      schema[table.table_name] = {
        schema: table.table_schema,
        columns: columns.rows
          .filter((col) => col.table_name === table.table_name)
          .map((col) => ({
            name: col.column_name,
            type: col.data_type,
            nullable: col.is_nullable === "YES",
            default: col.column_default,
          })),
      };
    }

    return schema;
  } catch (error) {
    await client.end().catch(() => {});
    throw error;
  }
}

/**
 * Get MySQL schema
 */
async function getMysqlSchema(config: ConnectionConfig): Promise<any> {
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port || 3306,
    database: config.database,
    user: config.username,
    password: config.password,
    ssl: config.sslConfig?.enabled
      ? {
          rejectUnauthorized: config.sslConfig.rejectUnauthorized ?? true,
          ca: config.sslConfig.ca,
          cert: config.sslConfig.cert,
          key: config.sslConfig.key,
        }
      : undefined,
  });

  try {
    const [tables]: any = await connection.execute(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = ?",
      [config.database]
    );

    const schema: Record<string, any> = {};

    for (const table of tables) {
      const [columns]: any = await connection.execute(
        `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_schema = ? AND table_name = ?
         ORDER BY ordinal_position`,
        [config.database, table.table_name]
      );

      schema[table.table_name] = {
        columns: columns.map((col: any) => ({
          name: col.column_name,
          type: col.data_type,
          nullable: col.is_nullable === "YES",
          default: col.column_default,
        })),
      };
    }

    await connection.end();
    return schema;
  } catch (error) {
    await connection.end().catch(() => {});
    throw error;
  }
}