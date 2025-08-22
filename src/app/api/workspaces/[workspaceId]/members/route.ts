/**
 * Workspace Members API Routes
 * 
 * Handles workspace membership management
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { users, memberships, invitations } from "@/lib/db/schema";
import { 
  inviteUserSchema, 
  paginationSchema,
  workspaceIdParamSchema 
} from "@/lib/api/validation";
import { eq, and, desc } from "drizzle-orm";
import { checkPermission } from "@/lib/auth/permissions";
import { auditLog } from "@/lib/audit";
import { nanoid } from "nanoid";
import { sendEmail } from "@/lib/email";

/**
 * GET /api/workspaces/[workspaceId]/members
 * 
 * Get all members of a workspace
 */
export async function GET(
  request: NextRequest,
  props: { params: { workspaceId: string } }
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
    const { workspaceId } = workspaceIdParamSchema.parse(props.params);

    // Check permission
    const hasPermission = await checkPermission(
      session.user.id,
      workspaceId,
      "workspace",
      "view"
    );

    if (!hasPermission) {
      return NextResponse.json(
        { error: "Forbidden", message: "Access denied" },
        { status: 403 }
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

    const offset = (params.page - 1) * params.limit;

    // Get workspace members
    const workspaceMembers = await db
      .select({
        membership: memberships,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          avatar: users.avatar,
        },
      })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(
        and(
          eq(memberships.workspaceId, workspaceId),
          eq(memberships.isActive, true)
        )
      )
      .orderBy(desc(memberships.createdAt))
      .limit(params.limit)
      .offset(offset);

    // Get pending invitations
    const pendingInvitations = await db
      .select({
        id: invitations.id,
        email: invitations.email,
        role: invitations.role,
        invitedAt: invitations.createdAt,
        expiresAt: invitations.expiresAt,
      })
      .from(invitations)
      .where(
        and(
          eq(invitations.workspaceId, workspaceId),
          eq(invitations.status, "pending")
        )
      )
      .orderBy(desc(invitations.createdAt));

    // Format response
    const data = workspaceMembers.map(({ membership, user }) => ({
      id: membership.id,
      userId: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: membership.role,
      joinedAt: membership.createdAt,
      isActive: membership.isActive,
    }));

    return NextResponse.json({
      members: data,
      invitations: pendingInvitations,
      pagination: {
        page: params.page,
        limit: params.limit,
        total: data.length + pendingInvitations.length,
        pages: Math.ceil((data.length + pendingInvitations.length) / params.limit),
      },
    });
  } catch (error) {
    console.error("Error fetching workspace members:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "Failed to fetch workspace members",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workspaces/[workspaceId]/members
 * 
 * Invite a user to workspace
 */
export async function POST(
  request: NextRequest,
  props: { params: { workspaceId: string } }
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
    const { workspaceId } = workspaceIdParamSchema.parse(props.params);

    // Check permission
    const hasPermission = await checkPermission(
      session.user.id,
      workspaceId,
      "workspace",
      "invite"
    );

    if (!hasPermission) {
      return NextResponse.json(
        { error: "Forbidden", message: "Access denied" },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = inviteUserSchema.parse(body);

    // Check if user is already a member
    const existingMember = await db
      .select({ id: memberships.id })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(
        and(
          eq(users.email, validatedData.email),
          eq(memberships.workspaceId, workspaceId),
          eq(memberships.isActive, true)
        )
      )
      .limit(1);

    if (existingMember.length > 0) {
      return NextResponse.json(
        {
          error: "Conflict",
          message: "User is already a member of this workspace",
        },
        { status: 409 }
      );
    }

    // Check for existing pending invitation
    const existingInvitation = await db
      .select({ id: invitations.id })
      .from(invitations)
      .where(
        and(
          eq(invitations.email, validatedData.email),
          eq(invitations.workspaceId, workspaceId),
          eq(invitations.status, "pending")
        )
      )
      .limit(1);

    if (existingInvitation.length > 0) {
      return NextResponse.json(
        {
          error: "Conflict",
          message: "An invitation has already been sent to this email",
        },
        { status: 409 }
      );
    }

    // Create invitation
    const invitationId = nanoid();
    const invitationToken = nanoid(32);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    await db.insert(invitations).values({
      workspaceId,
      email: validatedData.email,
      role: validatedData.role,
      invitedById: session.user.id,
      token: invitationToken,
      status: "pending",
      expiresAt,
    });

    // Send invitation email
    await sendEmail({
      to: validatedData.email,
      subject: "You've been invited to join a QueryGenie workspace",
      template: "workspace-invitation",
      data: {
        inviterName: session.user.name || session.user.email,
        workspaceName: workspaceId, // TODO: Get workspace name
        role: validatedData.role,
        message: validatedData.message,
        invitationLink: `${process.env.NEXTAUTH_URL}/invitations/${invitationToken}`,
      },
    });

    // Log audit event
    await auditLog({
      workspaceId,
      userId: session.user.id,
      action: "member.invited",
      resource: "invitation",
      resourceId: invitationId,
      metadata: {
        email: validatedData.email,
        role: validatedData.role,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Invitation sent successfully",
        data: {
          id: invitationId,
          email: validatedData.email,
          role: validatedData.role,
          expiresAt,
        },
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

    console.error("Error inviting user:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "Failed to send invitation",
      },
      { status: 500 }
    );
  }
}