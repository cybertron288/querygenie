/**
 * Query Executor
 * 
 * Safely executes SQL queries against various database types
 */

import { Client as PgClient } from "pg";
import mysql from "mysql2/promise";
import Database from "better-sqlite3";
import { decrypt } from "@/lib/encryption";

interface QueryOptions {
  connection: {
    type: string;
    host?: string;
    port?: number;
    database: string;
    username?: string;
    password: string;
    sslConfig?: string | null;
  };
  sqlQuery: string;
  limit?: number;
  timeout?: number;
}

interface QueryResult {
  success: boolean;
  columns?: string[];
  rows?: any[];
  rowCount?: number;
  error?: string;
}

/**
 * Execute a SQL query
 */
export async function executeQuery(options: QueryOptions): Promise<QueryResult> {
  try {
    // Handle empty or missing credentials
    let password = "";
    if (options.connection.password) {
      try {
        password = await decrypt(options.connection.password);
      } catch (error) {
        console.error("Failed to decrypt password, using empty password");
        password = "";
      }
    }
    
    // Decrypt SSL config if present
    let sslConfig = null;
    if (options.connection.sslConfig) {
      try {
        const decryptedConfig = await decrypt(options.connection.sslConfig);
        sslConfig = JSON.parse(decryptedConfig);
      } catch (error) {
        console.error("Failed to decrypt SSL config, skipping");
      }
    }

    // Apply limit if not already in query
    let query = options.sqlQuery;
    if (options.limit && !query.match(/\bLIMIT\s+\d+/i)) {
      query = `${query} LIMIT ${options.limit}`;
    }

    switch (options.connection.type) {
      case "postgres":
        return await executePostgresQuery({
          ...options.connection,
          password,
          sslConfig,
          sqlQuery: query,
          timeout: options.timeout,
        });
      
      case "mysql":
        return await executeMysqlQuery({
          ...options.connection,
          password,
          sslConfig,
          sqlQuery: query,
          timeout: options.timeout,
        });
      
      case "sqlite":
        return await executeSqliteQuery({
          ...options.connection,
          sqlQuery: query,
          timeout: options.timeout,
        });
      
      default:
        return {
          success: false,
          error: `Unsupported database type: ${options.connection.type}`,
        };
    }
  } catch (error: any) {
    console.error("Query execution error:", error);
    return {
      success: false,
      error: error.message || "Query execution failed",
    };
  }
}

/**
 * Execute PostgreSQL query
 */
async function executePostgresQuery(options: any): Promise<QueryResult> {
  const client = new PgClient({
    host: options.host,
    port: options.port || 5432,
    database: options.database,
    user: options.username,
    password: options.password,
    ssl: options.sslConfig?.enabled
      ? {
          rejectUnauthorized: options.sslConfig.rejectUnauthorized ?? true,
          ca: options.sslConfig.ca,
          cert: options.sslConfig.cert,
          key: options.sslConfig.key,
        }
      : false,
    statement_timeout: options.timeout || 30000,
    query_timeout: options.timeout || 30000,
  });

  try {
    await client.connect();
    
    const result = await client.query(options.sqlQuery);
    
    await client.end();

    // Format result based on query type
    if (result.command === "SELECT" || result.rows) {
      return {
        success: true,
        columns: result.fields?.map((f: any) => f.name) || [],
        rows: result.rows,
        rowCount: result.rowCount || 0,
      };
    } else {
      // For INSERT, UPDATE, DELETE
      return {
        success: true,
        rowCount: result.rowCount || 0,
      };
    }
  } catch (error: any) {
    await client.end().catch(() => {});
    
    // Parse PostgreSQL error
    let errorMessage = error.message;
    if (error.code) {
      switch (error.code) {
        case "42P01":
          errorMessage = `Table does not exist: ${error.message}`;
          break;
        case "42703":
          errorMessage = `Column does not exist: ${error.message}`;
          break;
        case "42601":
          errorMessage = `Syntax error: ${error.message}`;
          break;
        case "57014":
          errorMessage = "Query timeout exceeded";
          break;
        default:
          errorMessage = `Database error (${error.code}): ${error.message}`;
      }
    }
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Execute MySQL query
 */
async function executeMysqlQuery(options: any): Promise<QueryResult> {
  let connection;
  
  try {
    const connectionConfig: any = {
      host: options.host,
      port: options.port || 3306,
      database: options.database,
      user: options.username,
      password: options.password,
      connectTimeout: 10000,
    };
    
    if (options.sslConfig?.enabled) {
      connectionConfig.ssl = {
        rejectUnauthorized: options.sslConfig.rejectUnauthorized ?? true,
        ca: options.sslConfig.ca,
        cert: options.sslConfig.cert,
        key: options.sslConfig.key,
      };
    }
    
    connection = await mysql.createConnection(connectionConfig);

    // Set query timeout
    if (options.timeout) {
      await connection.execute(`SET SESSION max_execution_time = ${options.timeout}`);
    }

    const [rows, fields]: any = await connection.execute(options.sqlQuery);
    
    await connection.end();

    // Format result based on query type
    if (Array.isArray(rows)) {
      // SELECT query
      return {
        success: true,
        columns: fields?.map((f: any) => f.name) || [],
        rows: rows,
        rowCount: rows.length,
      };
    } else {
      // INSERT, UPDATE, DELETE
      return {
        success: true,
        rowCount: rows.affectedRows || 0,
      };
    }
  } catch (error: any) {
    if (connection) {
      await connection.end().catch(() => {});
    }
    
    // Parse MySQL error
    let errorMessage = error.message;
    if (error.code) {
      switch (error.code) {
        case "ER_NO_SUCH_TABLE":
          errorMessage = `Table does not exist: ${error.message}`;
          break;
        case "ER_BAD_FIELD_ERROR":
          errorMessage = `Column does not exist: ${error.message}`;
          break;
        case "ER_PARSE_ERROR":
          errorMessage = `Syntax error: ${error.message}`;
          break;
        case "ER_QUERY_TIMEOUT":
          errorMessage = "Query timeout exceeded";
          break;
        default:
          errorMessage = `Database error (${error.code}): ${error.message}`;
      }
    }
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Execute SQLite query
 */
async function executeSqliteQuery(options: any): Promise<QueryResult> {
  try {
    const db = new Database(options.database, {
      readonly: false,
      timeout: options.timeout || 5000,
    });

    // Determine query type
    const queryType = options.sqlQuery.trim().toUpperCase().split(/\s+/)[0];
    
    if (queryType === "SELECT") {
      const stmt = db.prepare(options.sqlQuery);
      const rows = stmt.all();
      
      // Get column names
      const columns = rows.length > 0 ? Object.keys(rows[0] as any) : [];
      
      db.close();
      
      return {
        success: true,
        columns,
        rows,
        rowCount: rows.length,
      };
    } else {
      // For INSERT, UPDATE, DELETE
      const stmt = db.prepare(options.sqlQuery);
      const info = stmt.run();
      
      db.close();
      
      return {
        success: true,
        rowCount: info.changes,
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: `SQLite error: ${error.message}`,
    };
  }
}

/**
 * Validate SQL query for safety
 */
export function validateSQLQuery(query: string): {
  valid: boolean;
  error?: string;
} {
  // Remove comments
  const cleanQuery = query
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .trim();

  // Check for multiple statements (basic check)
  if (cleanQuery.includes(";") && cleanQuery.lastIndexOf(";") !== cleanQuery.length - 1) {
    return {
      valid: false,
      error: "Multiple statements not allowed",
    };
  }

  // Check for dangerous keywords (very basic, not comprehensive)
  const dangerousKeywords = [
    "DROP DATABASE",
    "CREATE DATABASE",
    "ALTER DATABASE",
    "GRANT",
    "REVOKE",
    "CREATE USER",
    "DROP USER",
    "ALTER USER",
  ];

  const upperQuery = cleanQuery.toUpperCase();
  for (const keyword of dangerousKeywords) {
    if (upperQuery.includes(keyword)) {
      return {
        valid: false,
        error: `Dangerous operation not allowed: ${keyword}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Format query results for display
 */
export function formatQueryResults(result: QueryResult): {
  headers: string[];
  rows: string[][];
} {
  if (!result.success || !result.rows) {
    return { headers: [], rows: [] };
  }

  const headers = result.columns || [];
  const rows = result.rows.map((row) =>
    headers.map((col) => {
      const value = row[col];
      if (value === null) return "NULL";
      if (value === undefined) return "";
      if (typeof value === "object") return JSON.stringify(value);
      return String(value);
    })
  );

  return { headers, rows };
}