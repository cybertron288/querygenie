/**
 * Conversation Messages API
 * 
 * POST /api/conversations/[id]/messages - Add message to conversation
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { conversations, aiMessages, memberships } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";

// Request schemas
const addMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1),
  sqlQuery: z.string().optional(),
  explanation: z.string().optional(),
  confidence: z.number().min(0).max(100).optional(),
  executionTime: z.number().min(0).optional(),
  rowsAffected: z.number().min(0).optional(),
  error: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

/**
 * POST /api/conversations/[conversationId]/messages
 * Add new message to conversation
 */
export async function POST(
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
    const validated = addMessageSchema.parse(body);

    // Get conversation to verify access and ownership
    const [conversation] = await db
      .select({
        id: conversations.id,
        createdById: conversations.createdById,
        workspaceId: conversations.workspaceId,
        connectionId: conversations.connectionId,
        messageCount: conversations.messageCount,
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

    // Check access (must be owner or workspace member)
    let hasAccess = conversation.createdById === session.user.id;
    
    if (!hasAccess) {
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

      hasAccess = !!membership;
    }

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Add message to conversation
    const [newMessage] = await db
      .insert(aiMessages)
      .values({
        conversationId: params.conversationId,
        role: validated.role,
        content: validated.content,
        sqlQuery: validated.sqlQuery || null,
        explanation: validated.explanation || null,
        confidence: validated.confidence || null,
        executionTime: validated.executionTime || null,
        rowsAffected: validated.rowsAffected || null,
        error: validated.error || null,
        metadata: validated.metadata || {},
      })
      .returning({
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
      });

    // Update conversation activity and message count
    await db
      .update(conversations)
      .set({
        messageCount: (conversation.messageCount || 0) + 1,
        lastActivityAt: new Date(),
        updatedAt: new Date(),
        // Make this conversation active if user is adding a message
        ...(validated.role === "user" && { isActive: true }),
      })
      .where(eq(conversations.id, params.conversationId));

    // If this is a user message making the conversation active,
    // deactivate other conversations for the same connection
    if (validated.role === "user") {
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
            sql`${conversations.id} != ${params.conversationId}`
          )
        );
    }

    return NextResponse.json({
      message: newMessage,
      conversationId: params.conversationId,
    }, { status: 201 });

  } catch (error: any) {
    console.error("Error adding message:", error);

    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid message data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to add message" },
      { status: 500 }
    );
  }
}