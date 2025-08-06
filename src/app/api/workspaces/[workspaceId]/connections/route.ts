/**
 * Database Connections API Routes
 * 
 * Handles database connection management for workspaces
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { connections } from "@/lib/db/schema";
import { 
  createConnectionSchema, 
  paginationSchema,
  workspaceIdParamSchema 
} from "@/lib/api/validation";
import { eq, and, desc, sql } from "drizzle-orm";
import { checkPermission } from "@/lib/auth/permissions";
import { auditLog } from "@/lib/audit";
import { nanoid } from "nanoid";
import { encrypt, decrypt } from "@/lib/encryption";
import { testDatabaseConnection } from "@/lib/db/test-connection";

/**
 * GET /api/workspaces/[workspaceId]/connections
 * 
 * Get all connections for a workspace
 */
export async function GET(
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
      "connections:read"
    );

    if (!hasPermission) {
      return NextResponse.json(
        { error: "Forbidden", message: "Access denied" },
        { status: 403 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const paginationParams = paginationSchema.parse({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
      sort: searchParams.get("sort"),
      order: searchParams.get("order"),
    });

    const offset = (paginationParams.page - 1) * paginationParams.limit;

    // Get connections (without sensitive data)
    const workspaceConnections = await db
      .select({
        id: connections.id,
        name: connections.name,
        type: connections.type,
        mode: connections.mode,
        host: connections.host,
        port: connections.port,
        database: connections.database,
        username: connections.username,
        isActive: connections.isActive,
        lastTestedAt: connections.lastTestedAt,
        lastTestResult: connections.lastTestResult,
        createdAt: connections.createdAt,
        updatedAt: connections.updatedAt,
      })
      .from(connections)
      .where(
        and(
          eq(connections.workspaceId, workspaceId),
          eq(connections.isActive, true)
        )
      )
      .orderBy(desc(connections.createdAt))
      .limit(paginationParams.limit)
      .offset(offset);

    // Get total count
    const [{ count }] = await db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(connections)
      .where(
        and(
          eq(connections.workspaceId, workspaceId),
          eq(connections.isActive, true)
        )
      );

    return NextResponse.json({
      data: workspaceConnections,
      pagination: {
        page: paginationParams.page,
        limit: paginationParams.limit,
        total: count,
        pages: Math.ceil(count / paginationParams.limit),
      },
    });
  } catch (error) {
    console.error("Error fetching connections:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "Failed to fetch connections",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workspaces/[workspaceId]/connections
 * 
 * Create a new database connection
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
      "connections:create"
    );

    if (!hasPermission) {
      return NextResponse.json(
        { error: "Forbidden", message: "Access denied" },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = createConnectionSchema.parse(body);

    // Test the connection before saving
    const testResult = await testDatabaseConnection({
      type: validatedData.type,
      host: validatedData.host,
      port: validatedData.port,
      database: validatedData.database,
      username: validatedData.username,
      password: validatedData.password,
      sslConfig: validatedData.sslConfig,
    });

    if (!testResult.success) {
      return NextResponse.json(
        {
          error: "Connection Failed",
          message: "Unable to connect to the database",
          details: testResult.error,
        },
        { status: 400 }
      );
    }

    // Encrypt sensitive data
    const encryptedPassword = await encrypt(validatedData.password);
    const encryptedSslConfig = validatedData.sslConfig 
      ? await encrypt(JSON.stringify(validatedData.sslConfig))
      : null;

    // Create connection
    const connectionId = nanoid();
    
    const [newConnection] = await db
      .insert(connections)
      .values({
        id: connectionId,
        workspaceId,
        name: validatedData.name,
        type: validatedData.type,
        mode: validatedData.mode,
        host: validatedData.host,
        port: validatedData.port,
        database: validatedData.database,
        username: validatedData.username,
        password: encryptedPassword,
        sslConfig: encryptedSslConfig,
        isActive: true,
        lastTestedAt: new Date(),
        lastTestResult: testResult.metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({
        id: connections.id,
        name: connections.name,
        type: connections.type,
        mode: connections.mode,
        host: connections.host,
        port: connections.port,
        database: connections.database,
        username: connections.username,
        isActive: connections.isActive,
        lastTestedAt: connections.lastTestedAt,
        lastTestResult: connections.lastTestResult,
        createdAt: connections.createdAt,
      });

    // Log audit event
    await auditLog({
      workspaceId,
      userId: session.user.id,
      action: "connection.created",
      resource: "connection",
      resourceId: connectionId,
      metadata: {
        name: validatedData.name,
        type: validatedData.type,
        database: validatedData.database,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Connection created successfully",
        data: newConnection,
      },
      { status: 201 }
    );
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

    console.error("Error creating connection:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "Failed to create connection",
      },
      { status: 500 }
    );
  }
}