/**
 * Conversations API
 * 
 * Manages AI chat conversations (simplified version without workspaces)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { conversations, connections } from "@/lib/db/schema";
import { eq, and, desc, isNull } from "drizzle-orm";
import { z } from "zod";
import { nanoid } from "nanoid";

// Request validation schemas
const listConversationsSchema = z.object({
  connectionId: z.string().optional(),
  limit: z.preprocess(
    (val) => val === null || val === undefined || val === "" ? 10 : Number(val),
    z.number().min(1).max(100)
  ),
  offset: z.preprocess(
    (val) => val === null || val === undefined || val === "" ? 0 : Number(val),
    z.number().min(0)
  ),
});

/**
 * GET /api/conversations
 * List conversations for the current user, optionally filtered by connection
 */
export async function GET(request: NextRequest) {
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
      connectionId: searchParams.get("connectionId"),
      limit: searchParams.get("limit"),
      offset: searchParams.get("offset"),
    };

    const validated = listConversationsSchema.parse(query);

    // Build query conditions
    const conditions = [
      eq(conversations.createdById, session.user.id),
      isNull(conversations.deletedAt),
    ];

    if (validated.connectionId) {
      conditions.push(eq(conversations.connectionId, validated.connectionId));
    }

    // Fetch conversations
    const userConversations = await db
      .select({
        id: conversations.id,
        title: conversations.title,
        description: conversations.description,
        messageCount: conversations.messageCount,
        lastActivityAt: conversations.lastActivityAt,
        connectionId: conversations.connectionId,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
        connection: {
          id: connections.id,
          name: connections.name,
          type: connections.type,
          database: connections.database,
        },
      })
      .from(conversations)
      .leftJoin(connections, eq(conversations.connectionId, connections.id))
      .where(and(...conditions))
      .orderBy(desc(conversations.lastActivityAt))
      .limit(validated.limit)
      .offset(validated.offset);

    return NextResponse.json({
      success: true,
      conversations: userConversations,
      pagination: {
        limit: validated.limit,
        offset: validated.offset,
        total: userConversations.length,
      },
    });
  } catch (error: any) {
    console.error("Error fetching conversations:", error);
    
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid query parameters" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/conversations
 * Create a new conversation
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
    const { connectionId, title } = body;

    if (!connectionId) {
      return NextResponse.json(
        { error: "connectionId is required" },
        { status: 400 }
      );
    }

    // Verify the connection belongs to the user
    const [connection] = await db
      .select()
      .from(connections)
      .where(
        and(
          eq(connections.id, connectionId),
          eq(connections.createdById, session.user.id),
          isNull(connections.deletedAt)
        )
      )
      .limit(1);

    if (!connection) {
      return NextResponse.json(
        { error: "Connection not found or access denied" },
        { status: 404 }
      );
    }

    // Create conversation
    // Using a dummy workspace ID for now since the schema requires it
    const dummyWorkspaceId = "00000000-0000-0000-0000-000000000000";
    
    const [newConversation] = await db
      .insert(conversations)
      .values({
        workspaceId: dummyWorkspaceId, // Required by schema but not used
        createdById: session.user.id,
        connectionId,
        title: title || "New Conversation",
        description: null,
        messageCount: 0,
        lastActivityAt: new Date(),
      })
      .returning();

    return NextResponse.json({
      success: true,
      conversation: newConversation,
    });
  } catch (error) {
    console.error("Error creating conversation:", error);
    return NextResponse.json(
      { error: "Failed to create conversation" },
      { status: 500 }
    );
  }
}