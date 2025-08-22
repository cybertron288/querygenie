/**
 * AI Query Execution Tool API
 * 
 * Allows AI to execute read-only queries to explore database schema
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { connections, memberships } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { executeQuery, validateSQLQuery } from "@/lib/db/query-executor";
import { z } from "zod";

// Request validation
const executeToolSchema = z.object({
  connectionId: z.string().uuid(),
  query: z.string(),
  conversationId: z.string().uuid().optional(),
});

/**
 * POST /api/ai/execute-tool
 * Execute a read-only query for AI exploration
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { connectionId, query } = executeToolSchema.parse(body);

    // Validate it's a read-only query
    const validation = validateSQLQuery(query);
    if (!validation.valid) {
      return NextResponse.json(
        { 
          error: "Invalid Query", 
          message: validation.error,
          allowed: false 
        },
        { status: 400 }
      );
    }

    // Check if it's a write operation
    const isWriteOperation = /^\s*(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TRUNCATE|GRANT|REVOKE)/i.test(query);
    if (isWriteOperation) {
      return NextResponse.json(
        { 
          error: "Write Operation Not Allowed", 
          message: "AI can only execute read-only queries for exploration",
          allowed: false
        },
        { status: 403 }
      );
    }

    // Get connection and verify access
    const [connection] = await db
      .select({
        id: connections.id,
        workspaceId: connections.workspaceId,
        type: connections.type,
        host: connections.host,
        port: connections.port,
        database: connections.database,
        username: connections.username,
        encryptedCredentials: connections.encryptedCredentials,
        sslConfig: connections.sslConfig,
      })
      .from(connections)
      .where(
        and(
          eq(connections.id, connectionId),
          eq(connections.isActive, true),
          isNull(connections.deletedAt)
        )
      )
      .limit(1);

    if (!connection) {
      return NextResponse.json(
        { error: "Connection not found" },
        { status: 404 }
      );
    }

    // Check workspace membership
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
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Execute the query with a strict limit
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
      sqlQuery: query,
      limit: 100, // Strict limit for exploration
      timeout: 10000, // 10 second timeout
    });

    if (!result.success) {
      return NextResponse.json(
        { 
          error: "Query Failed", 
          message: result.error,
          executed: false
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      executed: true,
      columns: result.columns,
      rows: result.rows,
      rowCount: result.rowCount,
    });

  } catch (error: any) {
    console.error("AI tool execution error:", error);
    return NextResponse.json(
      { 
        error: "Execution Failed", 
        message: error.message,
        executed: false
      },
      { status: 500 }
    );
  }
}