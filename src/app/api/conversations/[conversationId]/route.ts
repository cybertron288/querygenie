/**
 * Individual Conversation API
 * 
 * GET /api/conversations/[id] - Get conversation details with messages
 * PUT /api/conversations/[id] - Update conversation (title, description, activate)
 * DELETE /api/conversations/[id] - Delete conversation (soft delete)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { conversations, aiMessages, memberships, connections } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { z } from "zod";

// Request schemas
const updateConversationSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

const messagesQuerySchema = z.object({
  limit: z.preprocess(
    (val) => val === null || val === undefined || val === "" ? 50 : Number(val),
    z.number().min(1).max(100)
  ),
  offset: z.preprocess(
    (val) => val === null || val === undefined || val === "" ? 0 : Number(val),
    z.number().min(0)
  ),
});

/**
 * GET /api/conversations/[conversationId]
 * Get conversation with messages
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = {
      limit: searchParams.get("limit"),
      offset: searchParams.get("offset"),
    };

    const validated = messagesQuerySchema.parse(query);

    // Get conversation with connection details
    const [conversation] = await db
      .select({
        id: conversations.id,
        title: conversations.title,
        description: conversations.description,
        isActive: conversations.isActive,
        messageCount: conversations.messageCount,
        lastActivityAt: conversations.lastActivityAt,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
        createdById: conversations.createdById,
        workspaceId: conversations.workspaceId,
        connection: {
          id: connections.id,
          name: connections.name,
          type: connections.type,
          database: connections.database,
        },
      })
      .from(conversations)
      .innerJoin(connections, eq(conversations.connectionId, connections.id))
      .where(
        and(
          eq(conversations.id, params.conversationId),
          sql`${conversations.deletedAt} IS NULL`
        )
      )
      .limit(1);

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Check access (must be owner or workspace member)
    if (conversation.createdById !== session.user.id) {
      const [membership] = await db
        .select()
        .from(memberships)
        .where(
          and(
            eq(memberships.userId, session.user.id),
            eq(memberships.workspaceId, conversation.workspaceId),
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
    }

    // Get messages
    const messages = await db
      .select({
        id: aiMessages.id,
        role: aiMessages.role,
        content: aiMessages.content,
        sqlQuery: aiMessages.sqlQuery,
        explanation: aiMessages.explanation,
        confidence: aiMessages.confidence,
        executionTime: aiMessages.executionTime,
        rowsAffected: aiMessages.rowsAffected,
        error: aiMessages.error,
        metadata: aiMessages.metadata,
        createdAt: aiMessages.createdAt,
      })
      .from(aiMessages)
      .where(eq(aiMessages.conversationId, params.conversationId))
      .orderBy(desc(aiMessages.createdAt))
      .limit(validated.limit)
      .offset(validated.offset);

    return NextResponse.json({
      conversation,
      messages: messages.reverse(), // Show oldest first
      pagination: {
        limit: validated.limit,
        offset: validated.offset,
        total: conversation.messageCount,
        hasMore: validated.offset + validated.limit < conversation.messageCount,
      },
    });

  } catch (error: any) {
    console.error("Error fetching conversation:", error);

    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid query parameters", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch conversation" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/conversations/[conversationId]
 * Update conversation details or activate it
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validated = updateConversationSchema.parse(body);

    // Get conversation to verify ownership and access
    const [conversation] = await db
      .select({
        id: conversations.id,
        createdById: conversations.createdById,
        workspaceId: conversations.workspaceId,
        connectionId: conversations.connectionId,
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.id, params.conversationId),
          sql`${conversations.deletedAt} IS NULL`
        )
      )
      .limit(1);

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Check ownership
    if (conversation.createdById !== session.user.id) {
      return NextResponse.json(
        { error: "Only conversation owner can update it" },
        { status: 403 }
      );
    }

    // If activating this conversation, deactivate others for same connection
    if (validated.isActive === true) {
      await db
        .update(conversations)
        .set({ 
          isActive: false,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(conversations.connectionId, conversation.connectionId),
            eq(conversations.createdById, session.user.id),
            eq(conversations.isActive, true),
            sql`${conversations.id} != ${params.conversationId}` // Don't update current conversation
          )
        );
    }

    // Update conversation
    const [updated] = await db
      .update(conversations)
      .set({
        ...validated,
        updatedAt: new Date(),
        ...(validated.isActive !== undefined && { lastActivityAt: new Date() }),
      })
      .where(eq(conversations.id, params.conversationId))
      .returning({
        id: conversations.id,
        title: conversations.title,
        description: conversations.description,
        isActive: conversations.isActive,
        messageCount: conversations.messageCount,
        lastActivityAt: conversations.lastActivityAt,
        updatedAt: conversations.updatedAt,
      });

    return NextResponse.json({
      conversation: updated,
    });

  } catch (error: any) {
    console.error("Error updating conversation:", error);

    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update conversation" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/conversations/[conversationId]
 * Soft delete conversation
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get conversation to verify ownership
    const [conversation] = await db
      .select({
        id: conversations.id,
        createdById: conversations.createdById,
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.id, params.conversationId),
          sql`${conversations.deletedAt} IS NULL`
        )
      )
      .limit(1);

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Check ownership
    if (conversation.createdById !== session.user.id) {
      return NextResponse.json(
        { error: "Only conversation owner can delete it" },
        { status: 403 }
      );
    }

    // Soft delete conversation
    await db
      .update(conversations)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
        isActive: false,
      })
      .where(eq(conversations.id, params.conversationId));

    return NextResponse.json({
      success: true,
      message: "Conversation deleted successfully",
    });

  } catch (error: any) {
    console.error("Error deleting conversation:", error);

    return NextResponse.json(
      { error: "Failed to delete conversation" },
      { status: 500 }
    );
  }
}