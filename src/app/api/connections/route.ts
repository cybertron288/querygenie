/**
 * Database Connections API
 * 
 * Manages database connections for workspaces
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { connections, memberships } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { z } from "zod";
import {
  createConnection,
} from "@/lib/db/connection-service";

// Validation schemas
const createConnectionSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(1).max(255),
  type: z.enum(["postgres", "mysql", "mssql", "sqlite"]),
  host: z.string().optional(),
  port: z.number().optional(),
  database: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  connectionString: z.string().optional(),
  ssl: z.boolean().optional(),
  sslConfig: z.any().optional(),
});

/**
 * GET /api/connections
 * Get connections for a workspace
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    
    if (!workspaceId) {
      return NextResponse.json(
        { error: "Bad Request", message: "workspaceId is required" },
        { status: 400 }
      );
    }

    // Check if user has access to workspace
    const [membership] = await db
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.userId, session.user.id),
          eq(memberships.workspaceId, workspaceId),
          eq(memberships.isActive, true)
        )
      )
      .limit(1);

    if (!membership) {
      return NextResponse.json(
        { error: "Forbidden", message: "Access denied to this workspace" },
        { status: 403 }
      );
    }

    // Get connections (without sensitive data)
    const workspaceConnections = await db
      .select({
        id: connections.id,
        name: connections.name,
        type: connections.type,
        host: connections.host,
        port: connections.port,
        database: connections.database,
        username: connections.username,
        ssl: connections.sslConfig,
        isActive: connections.isActive,
        lastConnectedAt: connections.lastConnectedAt,
        createdAt: connections.createdAt,
        updatedAt: connections.updatedAt,
      })
      .from(connections)
      .where(
        and(
          eq(connections.workspaceId, workspaceId),
          isNull(connections.deletedAt)
        )
      );

    console.log(`Found ${workspaceConnections.length} connections for workspace ${workspaceId}`);

    return NextResponse.json({
      success: true,
      connections: workspaceConnections,
    });
  } catch (error) {
    console.error("Error fetching connections:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to fetch connections" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/connections
 * Create a new connection
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = createConnectionSchema.parse(body);

    // Check if user has admin/owner access to workspace
    const [membership] = await db
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.userId, session.user.id),
          eq(memberships.workspaceId, validatedData.workspaceId),
          eq(memberships.isActive, true)
        )
      )
      .limit(1);

    if (!membership || !["owner", "admin", "editor"].includes(membership.role)) {
      return NextResponse.json(
        { error: "Forbidden", message: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Create connection with encrypted credentials
    const connectionId = await createConnection(
      validatedData.workspaceId,
      session.user.id,
      validatedData as any
    );

    return NextResponse.json({
      success: true,
      connectionId,
      message: "Connection created successfully",
    });
  } catch (error: any) {
    console.error("Error creating connection:", error);
    
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation Error", message: "Invalid data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal Server Error", message: error.message || "Failed to create connection" },
      { status: 500 }
    );
  }
}