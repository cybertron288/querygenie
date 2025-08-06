/**
 * AI Query Generation API
 * 
 * Generates SQL queries from natural language using AI models
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { generateSQLQuery } from "@/lib/ai/query-generator";
import { db } from "@/lib/db";
import { connections, workspaces, memberships, conversations, aiMessages } from "@/lib/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { z } from "zod";

// Request validation schema
const generateQuerySchema = z.object({
  prompt: z.string().min(1).max(1000),
  connectionId: z.string().optional(),
  conversationId: z.string().uuid().optional(),
  model: z.enum(["gemini", "gpt-3.5-turbo", "gpt-4", "claude"]).default("gemini"),
  includeSchema: z.boolean().default(true),
});

/**
 * POST /api/ai/generate
 * 
 * Generate SQL query from natural language
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
    const validatedData = generateQuerySchema.parse(body);

    // Get connection details if provided
    let connectionType = "postgres"; // Default
    let schema = {};

    if (validatedData.connectionId) {
      // Fetch connection details
      const connection = await db
        .select({
          id: connections.id,
          type: connections.type,
          workspaceId: connections.workspaceId,
        })
        .from(connections)
        .where(
          and(
            eq(connections.id, validatedData.connectionId),
            isNull(connections.deletedAt)
          )
        )
        .limit(1);

      if (connection.length === 0) {
        return NextResponse.json(
          { error: "Not Found", message: "Connection not found" },
          { status: 404 }
        );
      }

      // Check if user has access to this connection's workspace
      const membership = await db
        .select({
          id: memberships.id,
        })
        .from(memberships)
        .where(
          and(
            eq(memberships.userId, session.user.id),
            eq(memberships.workspaceId, connection[0].workspaceId),
            eq(memberships.isActive, true)
          )
        )
        .limit(1);

      if (membership.length === 0) {
        return NextResponse.json(
          { error: "Forbidden", message: "Access denied to this connection" },
          { status: 403 }
        );
      }

      connectionType = connection[0].type;

      // Get schema information if requested
      if (validatedData.includeSchema) {
        // In a production app, you would fetch the actual schema from the database
        // For now, we'll use a mock schema
        schema = await getConnectionSchema(validatedData.connectionId);
      }
    }

    // Generate SQL query using AI
    const result = await generateSQLQuery({
      prompt: validatedData.prompt,
      connectionType,
      model: validatedData.model as any,
      includeExamples: true,
      temperature: 0.2,
      schema,
    });

    // If conversation ID is provided, save messages to conversation
    if (validatedData.conversationId) {
      try {
        // Add user message
        await db.insert(aiMessages).values({
          conversationId: validatedData.conversationId,
          role: "user",
          content: validatedData.prompt,
        });

        // Add AI response
        await db.insert(aiMessages).values({
          conversationId: validatedData.conversationId,
          role: "assistant",
          content: result.explanation || "Here's the SQL query for your request:",
          sqlQuery: result.query,
          explanation: result.explanation,
          confidence: result.confidence,
          metadata: {
            model: validatedData.model,
            connectionType,
            timestamp: new Date().toISOString(),
          },
        });

        // Update conversation activity and message count
        await db
          .update(conversations)
          .set({
            messageCount: sql`${conversations.messageCount} + 2`, // User + AI message
            lastActivityAt: new Date(),
            updatedAt: new Date(),
            isActive: true,
          })
          .where(eq(conversations.id, validatedData.conversationId));

      } catch (convError) {
        console.error("Failed to save to conversation:", convError);
        // Continue without failing the request
      }
    }

    return NextResponse.json({
      success: true,
      sql: result.query,
      explanation: result.explanation,
      confidence: result.confidence,
      model: validatedData.model,
      connectionType,
      conversationId: validatedData.conversationId,
    });

  } catch (error: any) {
    console.error("Error generating query:", error);

    // Handle specific errors
    if (error.message?.includes("API key not configured")) {
      return NextResponse.json(
        { 
          error: "Configuration Error", 
          message: "AI model not configured. Please add your API key in settings.",
          details: error.message,
        },
        { status: 503 }
      );
    }

    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation Error", message: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: "Internal Server Error", 
        message: "Failed to generate query",
        details: process.env.NODE_ENV === "development" ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * Get schema information for a connection
 * In production, this would query the actual database
 */
async function getConnectionSchema(connectionId: string): Promise<Record<string, any>> {
  // Mock schema for demonstration
  // In production, you would:
  // 1. Get connection credentials from encrypted storage
  // 2. Connect to the database
  // 3. Query information_schema or equivalent
  // 4. Return the actual schema
  
  return {
    users: {
      columns: [
        { name: "id", type: "uuid", nullable: false },
        { name: "email", type: "varchar(255)", nullable: false },
        { name: "name", type: "varchar(255)", nullable: true },
        { name: "created_at", type: "timestamp", nullable: false },
        { name: "updated_at", type: "timestamp", nullable: false },
      ],
    },
    orders: {
      columns: [
        { name: "id", type: "uuid", nullable: false },
        { name: "user_id", type: "uuid", nullable: false },
        { name: "status", type: "varchar(50)", nullable: false },
        { name: "total_amount", type: "decimal(10,2)", nullable: false },
        { name: "created_at", type: "timestamp", nullable: false },
      ],
    },
    products: {
      columns: [
        { name: "id", type: "uuid", nullable: false },
        { name: "name", type: "varchar(255)", nullable: false },
        { name: "price", type: "decimal(10,2)", nullable: false },
        { name: "stock_quantity", type: "integer", nullable: false },
        { name: "category", type: "varchar(100)", nullable: true },
      ],
    },
  };
}