/**
 * Database Schema Introspection
 * 
 * Fetches actual table and column information from connected databases
 */

import { Client as PgClient } from "pg";
import mysql from "mysql2/promise";
import Database from "better-sqlite3";

export interface TableInfo {
  schema?: string;
  tableName: string;
  columns: ColumnInfo[];
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  isPrimary?: boolean;
  isForeign?: boolean;
  references?: {
    table: string;
    column: string;
  };
}

export interface SchemaInfo {
  tables: TableInfo[];
  schemas?: string[];
}

/**
 * Get schema information for PostgreSQL
 */
async function getPostgresSchema(config: any): Promise<SchemaInfo> {
  const client = new PgClient({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    ssl: config.sslConfig || false,
  });

  try {
    await client.connect();

    // Get all schemas
    const schemaResult = await client.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY schema_name
    `);

    // Get all tables with their schemas
    const tableResult = await client.query(`
      SELECT 
        table_schema,
        table_name,
        table_type
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
        AND table_type = 'BASE TABLE'
      ORDER BY table_schema, table_name
    `);

    // Get columns for all tables
    const columnResult = await client.query(`
      SELECT 
        c.table_schema,
        c.table_name,
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default,
        c.ordinal_position,
        tc.constraint_type,
        kcu2.table_schema AS foreign_table_schema,
        kcu2.table_name AS foreign_table_name,
        kcu2.column_name AS foreign_column_name
      FROM information_schema.columns c
      LEFT JOIN information_schema.key_column_usage kcu
        ON c.table_schema = kcu.table_schema
        AND c.table_name = kcu.table_name
        AND c.column_name = kcu.column_name
      LEFT JOIN information_schema.table_constraints tc
        ON kcu.constraint_name = tc.constraint_name
        AND kcu.table_schema = tc.table_schema
      LEFT JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
        AND tc.table_schema = rc.constraint_schema
      LEFT JOIN information_schema.key_column_usage kcu2
        ON rc.unique_constraint_name = kcu2.constraint_name
        AND rc.unique_constraint_schema = kcu2.constraint_schema
      WHERE c.table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY c.table_schema, c.table_name, c.ordinal_position
    `);

    // Organize data into structured format
    const tablesMap = new Map<string, TableInfo>();

    for (const row of columnResult.rows) {
      const tableKey = `${row.table_schema}.${row.table_name}`;
      
      if (!tablesMap.has(tableKey)) {
        tablesMap.set(tableKey, {
          schema: row.table_schema,
          tableName: row.table_name,
          columns: [],
        });
      }

      const table = tablesMap.get(tableKey)!;
      
      // Check if column already exists (due to multiple constraints)
      const existingColumn = table.columns.find(c => c.name === row.column_name);
      
      if (!existingColumn) {
        const columnInfo: ColumnInfo = {
          name: row.column_name,
          type: row.data_type,
          nullable: row.is_nullable === 'YES',
          isPrimary: row.constraint_type === 'PRIMARY KEY',
          isForeign: row.constraint_type === 'FOREIGN KEY',
        };
        
        if (row.foreign_table_name) {
          columnInfo.references = {
            table: `${row.foreign_table_schema}.${row.foreign_table_name}`,
            column: row.foreign_column_name,
          };
        }
        
        table.columns.push(columnInfo);
      } else {
        // Update existing column with additional constraint info
        if (row.constraint_type === 'PRIMARY KEY') {
          existingColumn.isPrimary = true;
        }
        if (row.constraint_type === 'FOREIGN KEY' && row.foreign_table_name) {
          existingColumn.isForeign = true;
          existingColumn.references = {
            table: `${row.foreign_table_schema}.${row.foreign_table_name}`,
            column: row.foreign_column_name,
          };
        }
      }
    }

    return {
      tables: Array.from(tablesMap.values()),
      schemas: schemaResult.rows.map(r => r.schema_name),
    };

  } finally {
    await client.end();
  }
}

/**
 * Get schema information for MySQL
 */
async function getMySQLSchema(config: any): Promise<SchemaInfo> {
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    ssl: config.sslConfig || undefined,
  });

  try {
    // Get all tables
    const [tables] = await connection.query(`
      SELECT 
        TABLE_NAME as table_name,
        TABLE_TYPE as table_type
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `) as any;

    // Get columns for all tables
    const [columns] = await connection.query(`
      SELECT 
        c.TABLE_NAME as table_name,
        c.COLUMN_NAME as column_name,
        c.DATA_TYPE as data_type,
        c.IS_NULLABLE as is_nullable,
        c.COLUMN_KEY as column_key,
        c.EXTRA as extra,
        c.ORDINAL_POSITION as ordinal_position,
        kcu.REFERENCED_TABLE_NAME as foreign_table,
        kcu.REFERENCED_COLUMN_NAME as foreign_column
      FROM information_schema.COLUMNS c
      LEFT JOIN information_schema.KEY_COLUMN_USAGE kcu
        ON c.TABLE_SCHEMA = kcu.TABLE_SCHEMA
        AND c.TABLE_NAME = kcu.TABLE_NAME
        AND c.COLUMN_NAME = kcu.COLUMN_NAME
        AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
      WHERE c.TABLE_SCHEMA = DATABASE()
      ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION
    `) as any;

    // Organize data
    const tablesMap = new Map<string, TableInfo>();

    for (const col of columns) {
      if (!tablesMap.has(col.table_name)) {
        tablesMap.set(col.table_name, {
          tableName: col.table_name,
          columns: [],
        });
      }

      const table = tablesMap.get(col.table_name)!;
      
      const columnInfo: ColumnInfo = {
        name: col.column_name,
        type: col.data_type,
        nullable: col.is_nullable === 'YES',
        isPrimary: col.column_key === 'PRI',
        isForeign: !!col.foreign_table,
      };
      
      if (col.foreign_table) {
        columnInfo.references = {
          table: col.foreign_table,
          column: col.foreign_column,
        };
      }
      
      table.columns.push(columnInfo);
    }

    return {
      tables: Array.from(tablesMap.values()),
    };

  } finally {
    await connection.end();
  }
}

/**
 * Get schema information for SQLite
 */
async function getSQLiteSchema(config: any): Promise<SchemaInfo> {
  const db = new Database(config.database, { readonly: true });

  try {
    // Get all tables
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
        AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all() as any[];

    const schemaInfo: SchemaInfo = { tables: [] };

    for (const table of tables) {
      // Get column info for each table
      const columns = db.prepare(`PRAGMA table_info('${table.name}')`).all() as any[];
      
      // Get foreign key info
      const foreignKeys = db.prepare(`PRAGMA foreign_key_list('${table.name}')`).all() as any[];
      
      const tableInfo: TableInfo = {
        tableName: table.name,
        columns: columns.map((col: any) => {
          const fk = foreignKeys.find((f: any) => f.from === col.name);
          
          const columnInfo: ColumnInfo = {
            name: col.name,
            type: col.type,
            nullable: col.notnull === 0,
            isPrimary: col.pk === 1,
            isForeign: !!fk,
          };
          
          if (fk) {
            columnInfo.references = {
              table: fk.table,
              column: fk.to,
            };
          }
          
          return columnInfo;
        }),
      };

      schemaInfo.tables.push(tableInfo);
    }

    return schemaInfo;

  } finally {
    db.close();
  }
}

/**
 * Get schema information for a database connection
 */
export async function getSchemaInfo(connectionType: string, config: any): Promise<SchemaInfo> {
  switch (connectionType) {
    case 'postgres':
      return getPostgresSchema(config);
    case 'mysql':
      return getMySQLSchema(config);
    case 'sqlite':
      return getSQLiteSchema(config);
    default:
      throw new Error(`Unsupported database type: ${connectionType}`);
  }
}

/**
 * Find tables that match a search term
 */
export function findMatchingTables(
  schemaInfo: SchemaInfo,
  searchTerms: string[]
): TableInfo[] {
  const matches: Array<{ table: TableInfo; score: number }> = [];

  for (const table of schemaInfo.tables) {
    let score = 0;
    const fullTableName = table.schema 
      ? `${table.schema}.${table.tableName}`.toLowerCase()
      : table.tableName.toLowerCase();

    // Check each search term
    for (const term of searchTerms) {
      const lowerTerm = term.toLowerCase();
      
      // Exact table name match
      if (table.tableName.toLowerCase() === lowerTerm) {
        score += 100;
      }
      // Table name contains term
      else if (table.tableName.toLowerCase().includes(lowerTerm)) {
        score += 50;
      }
      // Table name parts match (e.g., "user_role" matches "role")
      else if (table.tableName.toLowerCase().split(/[_\-]/).some(part => part === lowerTerm)) {
        score += 30;
      }
      
      // Check column names
      for (const column of table.columns) {
        if (column.name.toLowerCase().includes(lowerTerm)) {
          score += 10;
        }
      }
    }

    if (score > 0) {
      matches.push({ table, score });
    }
  }

  // Sort by score and return top matches
  return matches
    .sort((a, b) => b.score - a.score)
    .map(m => m.table);
}

/**
 * Generate table suggestions message
 */
export function generateTableSuggestions(tables: TableInfo[]): string {
  if (tables.length === 0) {
    return "I couldn't find any tables matching your description.";
  }

  if (tables.length === 1) {
    const table = tables[0];
    if (!table) return "I couldn't find any tables matching your description.";
    const fullName = table.schema ? `${table.schema}.${table.tableName}` : table.tableName;
    return `I found the table: **${fullName}**`;
  }

  // Multiple matches
  let message = "I found multiple tables that might match what you're looking for:\n\n";
  
  for (let i = 0; i < Math.min(5, tables.length); i++) {
    const table = tables[i];
    if (!table) continue;
    const fullName = table.schema ? `${table.schema}.${table.tableName}` : table.tableName;
    const columnNames = table.columns.slice(0, 5).map(c => c.name).join(', ');
    
    message += `${i + 1}. **${fullName}**\n`;
    message += `   Columns: ${columnNames}${table.columns.length > 5 ? ', ...' : ''}\n\n`;
  }

  if (tables.length > 5) {
    message += `\n...and ${tables.length - 5} more tables.\n\n`;
  }

  message += "Which table would you like to query?";
  
  return message;
}