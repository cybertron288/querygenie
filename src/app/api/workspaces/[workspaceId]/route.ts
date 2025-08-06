/**
 * Individual Workspace API Routes
 * 
 * Handles operations on specific workspaces
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { workspaces, memberships } from "@/lib/db/schema";
import { updateWorkspaceSchema, workspaceIdParamSchema } from "@/lib/api/validation";
import { eq, and } from "drizzle-orm";
import { checkPermission } from "@/lib/auth/permissions";
import { auditLog } from "@/lib/audit";

/**
 * GET /api/workspaces/[workspaceId]
 * 
 * Get a specific workspace
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
      "workspace:read"
    );

    if (!hasPermission) {
      return NextResponse.json(
        { error: "Forbidden", message: "Access denied" },
        { status: 403 }
      );
    }

    // Get workspace
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(
        and(
          eq(workspaces.id, workspaceId),
          eq(workspaces.isActive, true)
        )
      )
      .limit(1);

    if (!workspace) {
      return NextResponse.json(
        { error: "Not Found", message: "Workspace not found" },
        { status: 404 }
      );
    }

    // Get user's role in the workspace
    const [membership] = await db
      .select({ role: memberships.role })
      .from(memberships)
      .where(
        and(
          eq(memberships.userId, session.user.id),
          eq(memberships.workspaceId, workspaceId),
          eq(memberships.isActive, true)
        )
      )
      .limit(1);

    return NextResponse.json({
      ...workspace,
      currentUserRole: membership?.role || null,
    });
  } catch (error) {
    console.error("Error fetching workspace:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "Failed to fetch workspace",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/workspaces/[workspaceId]
 * 
 * Update a workspace
 */
export async function PATCH(
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
      "workspace:update"
    );

    if (!hasPermission) {
      return NextResponse.json(
        { error: "Forbidden", message: "Access denied" },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = updateWorkspaceSchema.parse(body);

    // Update workspace
    const [updatedWorkspace] = await db
      .update(workspaces)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(workspaces.id, workspaceId),
          eq(workspaces.isActive, true)
        )
      )
      .returning();

    if (!updatedWorkspace) {
      return NextResponse.json(
        { error: "Not Found", message: "Workspace not found" },
        { status: 404 }
      );
    }

    // Log audit event
    await auditLog({
      workspaceId,
      userId: session.user.id,
      action: "workspace.updated",
      resource: "workspace",
      resourceId: workspaceId,
      metadata: validatedData,
    });

    return NextResponse.json({
      success: true,
      message: "Workspace updated successfully",
      data: updatedWorkspace,
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

    console.error("Error updating workspace:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "Failed to update workspace",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workspaces/[workspaceId]
 * 
 * Delete a workspace (soft delete)
 */
export async function DELETE(
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

    // Check permission (only owner can delete)
    const hasPermission = await checkPermission(
      session.user.id,
      workspaceId,
      "workspace:delete"
    );

    if (!hasPermission) {
      return NextResponse.json(
        { error: "Forbidden", message: "Only workspace owner can delete" },
        { status: 403 }
      );
    }

    // Soft delete workspace
    const [deletedWorkspace] = await db
      .update(workspaces)
      .set({
        isActive: false,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(workspaces.id, workspaceId),
          eq(workspaces.isActive, true)
        )
      )
      .returning({ id: workspaces.id });

    if (!deletedWorkspace) {
      return NextResponse.json(
        { error: "Not Found", message: "Workspace not found" },
        { status: 404 }
      );
    }

    // Soft delete all memberships
    await db
      .update(memberships)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(memberships.workspaceId, workspaceId));

    // Log audit event
    await auditLog({
      workspaceId,
      userId: session.user.id,
      action: "workspace.deleted",
      resource: "workspace",
      resourceId: workspaceId,
    });

    return NextResponse.json({
      success: true,
      message: "Workspace deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting workspace:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "Failed to delete workspace",
      },
      { status: 500 }
    );
  }
}