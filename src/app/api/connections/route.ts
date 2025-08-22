/**
 * Database Connections API
 * 
 * Manages database connections for users (simplified version without workspaces)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { connections } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { z } from "zod";
import { nanoid } from "nanoid";
import { encrypt } from "@/lib/encryption";

// Validation schemas
const createConnectionSchema = z.object({
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
 * Get connections for the current user
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

    // Get connections created by the user (without sensitive data)
    const userConnections = await db
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
          eq(connections.createdById, session.user.id),
          isNull(connections.deletedAt)
        )
      );

    console.log(`Found ${userConnections.length} connections for user ${session.user.id}`);

    return NextResponse.json({
      success: true,
      connections: userConnections,
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
 * Create a new connection for the current user
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

    // Encrypt sensitive data
    const encryptedCreds: any = {};
    if (validatedData.password) {
      encryptedCreds.password = await encrypt(validatedData.password);
    }
    if (validatedData.connectionString) {
      encryptedCreds.connectionString = await encrypt(validatedData.connectionString);
    }

    // Create connection with encrypted credentials
    // Using a dummy workspace ID for now since the schema requires it
    const dummyWorkspaceId = "00000000-0000-0000-0000-000000000000";
    
    const [newConnection] = await db
      .insert(connections)
      .values({
        id: nanoid(),
        workspaceId: dummyWorkspaceId, // Required by schema but not used
        name: validatedData.name,
        type: validatedData.type as any,
        host: validatedData.host || null,
        port: validatedData.port || null,
        database: validatedData.database || null,
        username: validatedData.username || null,
        encryptedCredentials: JSON.stringify(encryptedCreds),
        sslConfig: validatedData.sslConfig || {},
        createdById: session.user.id,
        isActive: true,
      })
      .returning({ id: connections.id });

    return NextResponse.json({
      success: true,
      connectionId: newConnection?.id,
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