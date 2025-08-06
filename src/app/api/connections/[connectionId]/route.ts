/**
 * Individual Connection Management API
 * 
 * Update, delete, and test specific connections
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { connections, memberships } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import {
  updateConnection,
  deleteConnection,
  getConnectionConfig,
  testConnection,
  updateConnectionTestResult,
} from "@/lib/db/connection-service";

// Validation schemas
const updateConnectionSchema = z.object({
  name: z.string().min(1).max(255).optional(),
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
 * GET /api/connections/[connectionId]
 * Get connection details (with decrypted credentials for authorized users)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { connectionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    const { connectionId } = params;

    // Get connection to check workspace
    const [connection] = await db
      .select()
      .from(connections)
      .where(
        and(
          eq(connections.id, connectionId),
          eq(connections.deletedAt, null)
        )
      )
      .limit(1);

    if (!connection) {
      return NextResponse.json(
        { error: "Not Found", message: "Connection not found" },
        { status: 404 }
      );
    }

    // Check if user has access to workspace
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
        { error: "Forbidden", message: "Access denied" },
        { status: 403 }
      );
    }

    // Get decrypted config for admin/owner only
    if (["owner", "admin", "editor"].includes(membership.role)) {
      const config = await getConnectionConfig(connectionId);
      
      // Mask password for security
      if (config.password) {
        config.password = "********";
      }
      if (config.connectionString) {
        config.connectionString = "********";
      }

      return NextResponse.json({
        success: true,
        connection: {
          id: connection.id,
          ...config,
          createdAt: connection.createdAt,
          updatedAt: connection.updatedAt,
        },
      });
    } else {
      // Return limited info for viewers
      return NextResponse.json({
        success: true,
        connection: {
          id: connection.id,
          name: connection.name,
          type: connection.type,
          database: connection.database,
          isActive: connection.isActive,
        },
      });
    }
  } catch (error) {
    console.error("Error fetching connection:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to fetch connection" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/connections/[connectionId]
 * Update a connection
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { connectionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    const { connectionId } = params;
    const body = await request.json();
    const validatedData = updateConnectionSchema.parse(body);

    // Get connection to check workspace
    const [connection] = await db
      .select()
      .from(connections)
      .where(
        and(
          eq(connections.id, connectionId),
          eq(connections.deletedAt, null)
        )
      )
      .limit(1);

    if (!connection) {
      return NextResponse.json(
        { error: "Not Found", message: "Connection not found" },
        { status: 404 }
      );
    }

    // Check if user has admin/owner access
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

    if (!membership || !["owner", "admin", "editor"].includes(membership.role)) {
      return NextResponse.json(
        { error: "Forbidden", message: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Update connection
    await updateConnection(connectionId, session.user.id, validatedData);

    return NextResponse.json({
      success: true,
      message: "Connection updated successfully",
    });
  } catch (error: any) {
    console.error("Error updating connection:", error);
    
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation Error", message: "Invalid data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal Server Error", message: error.message || "Failed to update connection" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/connections/[connectionId]
 * Delete a connection (soft delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { connectionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    const { connectionId } = params;

    // Get connection to check workspace
    const [connection] = await db
      .select()
      .from(connections)
      .where(
        and(
          eq(connections.id, connectionId),
          eq(connections.deletedAt, null)
        )
      )
      .limit(1);

    if (!connection) {
      return NextResponse.json(
        { error: "Not Found", message: "Connection not found" },
        { status: 404 }
      );
    }

    // Check if user has admin/owner access
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

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json(
        { error: "Forbidden", message: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Delete connection
    await deleteConnection(connectionId);

    return NextResponse.json({
      success: true,
      message: "Connection deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting connection:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to delete connection" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/connections/[connectionId]/test
 * Test a specific connection
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { connectionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    const { connectionId } = params;

    // Get connection to check workspace
    const [connection] = await db
      .select()
      .from(connections)
      .where(
        and(
          eq(connections.id, connectionId),
          eq(connections.deletedAt, null)
        )
      )
      .limit(1);

    if (!connection) {
      return NextResponse.json(
        { error: "Not Found", message: "Connection not found" },
        { status: 404 }
      );
    }

    // Check if user has access
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
        { error: "Forbidden", message: "Access denied" },
        { status: 403 }
      );
    }

    // Get decrypted connection config
    const config = await getConnectionConfig(connectionId);

    // Test the connection
    const result = await testConnection(config);

    // Update test result in database
    await updateConnectionTestResult(connectionId, result);

    return NextResponse.json({
      success: result.success,
      message: result.message,
      details: result.details,
    });
  } catch (error: any) {
    console.error("Error testing connection:", error);
    return NextResponse.json(
      { 
        error: "Internal Server Error", 
        message: error.message || "Failed to test connection",
        details: { error: error.message }
      },
      { status: 500 }
    );
  }
}