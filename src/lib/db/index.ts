/**
 * Database Connection & Query Builder
 * 
 * Enterprise-grade PostgreSQL connection with:
 * - Connection pooling for performance
 * - Automatic reconnection
 * - Query logging in development
 * - Error handling and monitoring
 * - Type-safe queries with Drizzle ORM
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env, isDevelopment } from "@/lib/env";
import * as schema from "./schema";

/**
 * Create PostgreSQL connection
 */
const sql = postgres(env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: env.DATABASE_URL.includes('neon.tech') ? 'require' : false,
});

/**
 * Drizzle ORM instance with schema
 * Provides type-safe database queries
 */
export const db = drizzle(sql, {
  schema,
  logger: isDevelopment ? {
    logQuery: (query, params) => {
      console.log("📝 Drizzle Query:", {
        query: query.slice(0, 200) + (query.length > 200 ? "..." : ""),
        params: params?.slice(0, 5),
        timestamp: new Date().toISOString(),
      });
    },
  } : false,
});

/**
 * Raw SQL connection for advanced queries
 * Use sparingly - prefer Drizzle queries for type safety
 */
export { sql };

/**
 * Database connection health check
 * Useful for health endpoints and monitoring
 */
export async function checkDatabaseHealth(): Promise<{
  status: "healthy" | "unhealthy";
  latency: number;
  error?: string;
}> {
  const start = Date.now();
  
  try {
    // Simple health check query
    await sql`SELECT 1 as health_check`;
    
    const latency = Date.now() - start;
    
    return {
      status: "healthy",
      latency,
    };
  } catch (error) {
    const latency = Date.now() - start;
    
    console.error("❌ Database health check failed:", error);
    
    return {
      status: "unhealthy",
      latency,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Close database connection
 * Useful for testing and graceful shutdown
 */
export async function closeDatabase(): Promise<void> {
  try {
    await sql.end();
    console.log("✅ Database connection closed");
  } catch (error) {
    console.error("❌ Error closing database connection:", error);
    throw error;
  }
}

/**
 * Database transaction helper
 * Provides automatic rollback on errors
 */
export async function withTransaction<T>(
  callback: (tx: any) => Promise<T>
): Promise<T> {
  return db.transaction(callback as any);
}

/**
 * Connection pool statistics
 * Useful for monitoring and debugging
 */
export function getConnectionStats() {
  return {
    totalConnections: (sql as any).options?.max || 10,
    activeConnections: 0, // Not available in postgres.js
    idleConnections: 0, // Not available in postgres.js
    waitingConnections: 0, // Not available in postgres.js
  };
}

/**
 * Export schema for type safety
 */
export * from "./schema";
export type Database = typeof db;