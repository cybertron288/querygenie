/**
 * Query Execution API Routes
 * 
 * Handles SQL query execution against database connections
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { connections, queries, queryExecutions } from "@/lib/db/schema";
import { workspaceIdParamSchema } from "@/lib/api/validation";
import { eq, and } from "drizzle-orm";
import { checkPermission } from "@/lib/auth/permissions";
import { auditLog } from "@/lib/audit";
import { executeQuery } from "@/lib/db/query-executor";
import { z } from "zod";
import { randomUUID } from "crypto";

const executeQuerySchema = z.object({
  sql: z.string().min(1, "SQL query is required"),
  connectionId: z.string().uuid("Invalid connection ID"),
  title: z.string().optional(),
  saveQuery: z.boolean().default(false),
});

/**
 * POST /api/workspaces/[workspaceId]/execute
 * 
 * Execute a SQL query against a database connection
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    // Validate workspace ID
    const { workspaceId } = workspaceIdParamSchema.parse(params);

    // Check permission
    const hasPermission = await checkPermission(
      session.user.id,
      workspaceId,
      "query:execute"
    );

    if (!hasPermission) {
      return NextResponse.json(
        { error: "Forbidden", message: "Access denied" },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const { sql, connectionId, title, saveQuery } = executeQuerySchema.parse(body);

    // Get connection details
    const [connection] = await db
      .select()
      .from(connections)
      .where(
        and(
          eq(connections.id, connectionId),
          eq(connections.workspaceId, workspaceId),
          eq(connections.isActive, true),
          eq(connections.deletedAt, null)
        )
      )
      .limit(1);

    if (!connection) {
      return NextResponse.json(
        { error: "Not Found", message: "Database connection not found" },
        { status: 404 }
      );
    }

    // Check if connection is in read-only mode and query is destructive
    if (connection.mode === "read-only") {
      const destructiveOperations = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER', 'TRUNCATE'];
      const upperQuery = sql.toUpperCase().trim();
      
      if (destructiveOperations.some(op => upperQuery.startsWith(op))) {
        return NextResponse.json(
          { 
            error: "Forbidden", 
            message: "Write operations are not allowed on read-only connections" 
          },
          { status: 403 }
        );
      }
    }

    const startTime = Date.now();
    let queryResult;
    let error = null;

    try {
      // Execute the query
      queryResult = await executeQuery({
        connection: {
          type: connection.type,
          host: connection.host,
          port: connection.port,
          database: connection.database,
          username: connection.username,
          password: connection.encryptedCredentials,
          sslConfig: connection.sslConfig,
        },
        sqlQuery: sql,
        limit: 1000, // Default limit for safety
        timeout: 30000, // 30 second timeout
      });
    } catch (executionError: any) {
      error = executionError.message;
      queryResult = null;
    }

    const endTime = Date.now();
    const executionTime = endTime - startTime;

    // Create query record if saveQuery is true or if title is provided
    let savedQueryId: string | null = null;
    
    if (saveQuery || title) {
      const queryId = randomUUID();
      
      await db.insert(queries).values({
        id: queryId,
        workspaceId,
        connectionId,
        title: title || `Query ${new Date().toISOString()}`,
        sqlQuery: sql,
        status: error ? "failed" : "completed",
        executionTime,
        rowsAffected: queryResult?.rowCount || 0,
        errorMessage: error,
        isSaved: saveQuery,
        isShared: false,
        createdById: session.user.id,
      });
      
      savedQueryId = queryId;
    }

    // Record execution in query_executions table
    await db.insert(queryExecutions).values({
      workspaceId,
      connectionId,
      queryId: savedQueryId,
      executedById: session.user.id,
      sqlQuery: sql,
      status: error ? "failed" : "completed",
      executionTime,
      rowCount: queryResult?.rowCount || 0,
      errorMessage: error,
      metadata: {
        userAgent: request.headers.get("user-agent"),
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
      },
    });

    // Log audit event
    await auditLog({
      workspaceId,
      userId: session.user.id,
      action: "query.executed",
      resource: "query",
      resourceId: savedQueryId || undefined,
      metadata: {
        connectionId,
        executionTime,
        rowCount: queryResult?.rowCount || 0,
        hasError: !!error,
        sqlQuery: sql.substring(0, 200), // Log first 200 characters for auditing
      },
    });

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: "Query Execution Error",
          message: error,
          executionTime,
          queryId: savedQueryId,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        rows: queryResult.rows,
        columns: queryResult.columns,
        rowCount: queryResult.rowCount,
        executionTime,
        queryId: savedQueryId,
      },
    });

  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        {
          error: "Bad Request",
          message: "Invalid request data",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    console.error("Error executing query:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "Failed to execute query",
      },
      { status: 500 }
    );
  }
}