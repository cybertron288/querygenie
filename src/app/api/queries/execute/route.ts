/**
 * Query Execution API
 * 
 * Executes SQL queries against connected databases
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { connections, memberships, queries } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { executeQuery, validateSQLQuery } from "@/lib/db/query-executor";

// Request validation schema
const executeQuerySchema = z.object({
  connectionId: z.string().uuid(),
  sql: z.string().min(1).max(50000),
  saveQuery: z.boolean().optional(),
  queryName: z.string().optional(),
});

/**
 * POST /api/queries/execute
 * Execute a SQL query against a database connection
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = executeQuerySchema.parse(body);

    // Get connection details and verify access
    const [connection] = await db
      .select({
        id: connections.id,
        workspaceId: connections.workspaceId,
        name: connections.name,
        type: connections.type,
        host: connections.host,
        port: connections.port,
        database: connections.database,
        username: connections.username,
        encryptedCredentials: connections.encryptedCredentials,
        sslConfig: connections.sslConfig,
        mode: connections.mode,
      })
      .from(connections)
      .where(
        and(
          eq(connections.id, validatedData.connectionId),
          eq(connections.isActive, true)
        )
      )
      .limit(1);

    if (!connection) {
      return NextResponse.json(
        { error: "Not Found", message: "Connection not found or inactive" },
        { status: 404 }
      );
    }

    // Check if user has access to the workspace
    const [membership] = await db
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.userId, session.user.id),
          eq(memberships.workspaceId, connection.workspaceId),
          eq(memberships.isActive, true)
        )
      )
      .limit(1);

    if (!membership) {
      return NextResponse.json(
        { error: "Forbidden", message: "Access denied to this connection" },
        { status: 403 }
      );
    }

    // Validate SQL query for safety
    const validation = validateSQLQuery(validatedData.sql);
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Bad Request", message: validation.error },
        { status: 400 }
      );
    }

    // Check if connection is read-only for write operations
    const isWriteOperation = /^\s*(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TRUNCATE)/i.test(validatedData.sql);
    if (isWriteOperation && connection.mode === "read-only") {
      return NextResponse.json(
        { 
          error: "Forbidden", 
          message: "This connection is read-only. Write operations are not allowed." 
        },
        { status: 403 }
      );
    }

    // Execute the query using existing query executor
    const connectionConfig: any = {
      type: connection.type,
      database: connection.database || "",
      password: connection.encryptedCredentials || "",
    };
    
    if (connection.host) connectionConfig.host = connection.host;
    if (connection.port) connectionConfig.port = connection.port;
    if (connection.username) connectionConfig.username = connection.username;
    if (connection.sslConfig) connectionConfig.sslConfig = JSON.stringify(connection.sslConfig);
    
    const result = await executeQuery({
      connection: connectionConfig,
      sqlQuery: validatedData.sql,
      limit: 1000, // Default limit for safety
      timeout: 30000, // 30 second timeout
    });

    const executionTime = Date.now() - startTime;

    // Save query to history if requested
    if (validatedData.saveQuery && result.success) {
      try {
        await db.insert(queries).values({
          workspaceId: connection.workspaceId,
          connectionId: connection.id,
          title: validatedData.queryName || `Query at ${new Date().toISOString()}`,
          sqlQuery: validatedData.sql,
          createdById: session.user.id,
          executionTime,
          rowsAffected: result.rowCount || 0,
          status: "completed",
          errorMessage: null,
        });
      } catch (error) {
        console.error("Failed to save query to history:", error);
        // Don't fail the request if saving to history fails
      }
    }

    // Update last connected timestamp if query was successful
    if (result.success) {
      await db
        .update(connections)
        .set({ lastConnectedAt: new Date() })
        .where(eq(connections.id, connection.id));
    }

    // Return error if query failed
    if (!result.success) {
      return NextResponse.json(
        { 
          error: "Query Error", 
          message: result.error || "Query execution failed",
          executionTime,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      columns: result.columns,
      rows: result.rows,
      rowCount: result.rowCount,
      executionTime,
    });

  } catch (error: any) {
    console.error("Error executing query:", error);

    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation Error", message: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: "Internal Server Error", 
        message: error.message || "Failed to execute query",
        executionTime: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}