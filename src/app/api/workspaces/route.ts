/**
 * Workspace API Routes
 * 
 * Handles workspace creation and listing
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { workspaces, memberships } from "@/lib/db/schema";
import { createWorkspaceSchema, paginationSchema } from "@/lib/api/validation";
import { eq, desc, and, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { auditLog } from "@/lib/audit";

/**
 * GET /api/workspaces
 * 
 * Get all workspaces for the authenticated user
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

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const params = paginationSchema.parse({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
      sort: searchParams.get("sort"),
      order: searchParams.get("order"),
    });

    // Get user's workspaces with membership info
    const offset = (params.page - 1) * params.limit;
    
    // Query for workspaces
    const userWorkspaces = await db
      .select({
        workspace: workspaces,
        membership: memberships,
      })
      .from(memberships)
      .innerJoin(workspaces, eq(memberships.workspaceId, workspaces.id))
      .where(
        and(
          eq(memberships.userId, session.user.id),
          eq(memberships.isActive, true),
          eq(workspaces.isActive, true)
        )
      )
      .orderBy(desc(memberships.createdAt))
      .limit(params.limit)
      .offset(offset);

    // Get total count
    const [{ count }] = await db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(memberships)
      .innerJoin(workspaces, eq(memberships.workspaceId, workspaces.id))
      .where(
        and(
          eq(memberships.userId, session.user.id),
          eq(memberships.isActive, true),
          eq(workspaces.isActive, true)
        )
      );

    // Format response
    const data = userWorkspaces.map(({ workspace, membership }) => ({
      ...workspace,
      role: membership.role,
      joinedAt: membership.createdAt,
    }));

    return NextResponse.json({
      data,
      pagination: {
        page: params.page,
        limit: params.limit,
        total: count,
        pages: Math.ceil(count / params.limit),
      },
    });
  } catch (error) {
    console.error("Error fetching workspaces:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "Failed to fetch workspaces",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workspaces
 * 
 * Create a new workspace
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

    // Parse and validate request body
    const body = await request.json();
    const validatedData = createWorkspaceSchema.parse(body);

    // Check if slug is already taken
    const existingWorkspace = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.slug, validatedData.slug))
      .limit(1);

    if (existingWorkspace.length > 0) {
      return NextResponse.json(
        {
          error: "Conflict",
          message: "A workspace with this slug already exists",
        },
        { status: 409 }
      );
    }

    // Create workspace with transaction
    const workspaceId = nanoid();
    const membershipId = nanoid();

    await db.transaction(async (tx) => {
      // Create workspace
      await tx.insert(workspaces).values({
        id: workspaceId,
        name: validatedData.name,
        slug: validatedData.slug,
        description: validatedData.description,
        avatar: validatedData.avatar,
        ownerId: session.user.id,
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create owner membership
      await tx.insert(memberships).values({
        id: membershipId,
        userId: session.user.id,
        workspaceId: workspaceId,
        role: "owner",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    // Get the created workspace
    const [newWorkspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    // Log audit event
    await auditLog({
      workspaceId,
      userId: session.user.id,
      action: "workspace.created",
      resource: "workspace",
      resourceId: workspaceId,
      metadata: {
        name: validatedData.name,
        slug: validatedData.slug,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Workspace created successfully",
        data: newWorkspace,
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

    console.error("Error creating workspace:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "Failed to create workspace",
      },
      { status: 500 }
    );
  }
}