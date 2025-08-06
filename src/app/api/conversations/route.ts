/**
 * Conversations API
 * 
 * GET /api/conversations - List conversations for workspace
 * POST /api/conversations - Create new conversation
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { conversations, aiMessages, memberships, connections } from "@/lib/db/schema";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { z } from "zod";

// Request schemas
const createConversationSchema = z.object({
  connectionId: z.string().uuid(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(500).optional(),
});

const listConversationsSchema = z.object({
  workspaceId: z.string().uuid(),
  connectionId: z.string().uuid().optional(),
  limit: z.preprocess(
    (val) => val === null || val === undefined || val === "" ? 20 : Number(val),
    z.number().min(1).max(100)
  ),
  offset: z.preprocess(
    (val) => val === null || val === undefined || val === "" ? 0 : Number(val),
    z.number().min(0)
  ),
});

/**
 * GET /api/conversations
 * List conversations for workspace, optionally filtered by connection
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
      workspaceId: searchParams.get("workspaceId"),
      connectionId: searchParams.get("connectionId"),
      limit: searchParams.get("limit"),
      offset: searchParams.get("offset"),
    };

    const validated = listConversationsSchema.parse(query);

    // Check workspace access
    const [membership] = await db
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.userId, session.user.id),
          eq(memberships.workspaceId, validated.workspaceId),
          eq(memberships.isActive, true)
        )
      )
      .limit(1);

    if (!membership) {
      return NextResponse.json(
        { error: "Access denied to workspace" },
        { status: 403 }
      );
    }

    // Build query conditions
    const conditions = [
      eq(conversations.workspaceId, validated.workspaceId),
      eq(conversations.createdById, session.user.id),
      sql`${conversations.deletedAt} IS NULL`,
    ];

    if (validated.connectionId) {
      conditions.push(eq(conversations.connectionId, validated.connectionId));
    }

    // Get conversations with connection details and message count
    const results = await db
      .select({
        id: conversations.id,
        title: conversations.title,
        description: conversations.description,
        isActive: conversations.isActive,
        messageCount: conversations.messageCount,
        lastActivityAt: conversations.lastActivityAt,
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
      .innerJoin(connections, eq(conversations.connectionId, connections.id))
      .where(and(...conditions))
      .orderBy(desc(conversations.lastActivityAt))
      .limit(validated.limit)
      .offset(validated.offset);

    // Get total count for pagination
    const [{ total }] = await db
      .select({ total: count() })
      .from(conversations)
      .where(and(...conditions));

    return NextResponse.json({
      conversations: results,
      pagination: {
        total,
        limit: validated.limit,
        offset: validated.offset,
        hasMore: validated.offset + validated.limit < total,
      },
    });

  } catch (error: any) {
    console.error("Error fetching conversations:", error);

    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid query parameters", details: error.errors },
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
 * Create new conversation for a database connection
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
    const validated = createConversationSchema.parse(body);

    // Get connection and verify access
    const [connection] = await db
      .select({
        id: connections.id,
        name: connections.name,
        type: connections.type,
        database: connections.database,
        workspaceId: connections.workspaceId,
      })
      .from(connections)
      .where(
        and(
          eq(connections.id, validated.connectionId),
          eq(connections.isActive, true),
          sql`${connections.deletedAt} IS NULL`
        )
      )
      .limit(1);

    if (!connection) {
      return NextResponse.json(
        { error: "Connection not found or inactive" },
        { status: 404 }
      );
    }

    // Check workspace access
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
        { error: "Access denied to workspace" },
        { status: 403 }
      );
    }

    // Deactivate existing active conversation for this connection/user
    await db
      .update(conversations)
      .set({ 
        isActive: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(conversations.connectionId, validated.connectionId),
          eq(conversations.createdById, session.user.id),
          eq(conversations.isActive, true)
        )
      );

    // Create new conversation
    const title = validated.title || `${connection.name} - ${new Date().toLocaleDateString()}`;

    const [newConversation] = await db
      .insert(conversations)
      .values({
        workspaceId: connection.workspaceId,
        connectionId: validated.connectionId,
        title,
        description: validated.description,
        createdById: session.user.id,
        isActive: true,
        messageCount: 0,
        lastActivityAt: new Date(),
      })
      .returning({
        id: conversations.id,
        title: conversations.title,
        description: conversations.description,
        isActive: conversations.isActive,
        messageCount: conversations.messageCount,
        lastActivityAt: conversations.lastActivityAt,
        createdAt: conversations.createdAt,
      });

    // Add welcome message
    await db.insert(aiMessages).values({
      conversationId: newConversation.id,
      role: "assistant",
      content: `Hello! I'm your AI SQL Assistant for the ${connection.name} database. I can help you generate SQL queries from natural language descriptions. What would you like to explore in your ${connection.type} database?`,
      metadata: { isWelcome: true },
    });

    // Update message count
    await db
      .update(conversations)
      .set({ messageCount: 1 })
      .where(eq(conversations.id, newConversation.id));

    return NextResponse.json({
      conversation: {
        ...newConversation,
        messageCount: 1,
        connection: {
          id: connection.id,
          name: connection.name,
          type: connection.type,
          database: connection.database,
        },
      },
    }, { status: 201 });

  } catch (error: any) {
    console.error("Error creating conversation:", error);

    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create conversation" },
      { status: 500 }
    );
  }
}