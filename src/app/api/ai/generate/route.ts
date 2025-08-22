/**
 * AI Query Generation API
 * 
 * Generates SQL queries from natural language using AI models
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { generateEnhancedSQLQuery } from "@/lib/ai/enhanced-query-generator";
import { getSchemaInfo } from "@/lib/db/schema-introspection";
import { getConnectionConfig } from "@/lib/db/connection-service";
import { db } from "@/lib/db";
import { connections, memberships, conversations, aiMessages } from "@/lib/db/schema";
import { eq, and, isNull, sql, asc } from "drizzle-orm";
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
    let connectionConfig = null;
    let schemaInfo = null;
    let conversationHistory: any[] = [];

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
            eq(memberships.workspaceId, connection[0]!.workspaceId),
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

      connectionType = connection[0]!.type;

      // Get connection config for schema introspection
      try {
        connectionConfig = await getConnectionConfig(validatedData.connectionId);
        
        // Get actual schema information from the database
        schemaInfo = await getSchemaInfo(connectionType, connectionConfig);
      } catch (error) {
        console.error("Failed to get schema info:", error);
        // Continue without schema info
      }
    }

    // Get conversation history if conversationId is provided
    if (validatedData.conversationId) {
      const messages = await db
        .select({
          role: aiMessages.role,
          content: aiMessages.content,
        })
        .from(aiMessages)
        .where(eq(aiMessages.conversationId, validatedData.conversationId))
        .orderBy(asc(aiMessages.createdAt))
        .limit(10); // Last 10 messages for context

      conversationHistory = messages;
    }

    // Use enhanced SQL generation with schema awareness
    const generateOptions: any = {
      prompt: validatedData.prompt,
      connectionType,
      connectionConfig,
      conversationHistory,
      model: validatedData.model as any,
      temperature: 0.3,
    };
    
    if (schemaInfo) {
      generateOptions.schemaInfo = schemaInfo;
    }
    
    const result = await generateEnhancedSQLQuery(generateOptions);

    // If conversation ID is provided, save messages to conversation
    if (validatedData.conversationId) {
      try {
        // Add user message
        await db.insert(aiMessages).values({
          conversationId: validatedData.conversationId,
          role: "user",
          content: validatedData.prompt,
        });

        // Add AI response based on response type
        const responseContent = result.message || result.explanation || 
          (result.type === "query" ? "Here's the SQL query for your request:" : "");
        
        // For exploration queries, save the explorationQuery to sqlQuery field
        const sqlQuery = result.type === "exploration" 
          ? result.explorationQuery 
          : result.query;
        
        await db.insert(aiMessages).values({
          conversationId: validatedData.conversationId,
          role: "assistant",
          content: responseContent,
          sqlQuery: sqlQuery || null,
          explanation: result.explanation || null,
          confidence: result.confidence || null,
          metadata: {
            model: validatedData.model,
            connectionType,
            responseType: result.type,
            isExploration: result.type === "exploration",
            requiresConfirmation: result.requiresConfirmation || false,
            suggestions: result.suggestions?.map(t => ({
              schema: t.schema,
              tableName: t.tableName,
              columns: t.columns.length,
            })),
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
      type: result.type,
      sql: result.query || null,
      explorationQuery: result.explorationQuery || null,
      explanation: result.explanation || null,
      message: result.message || null,
      confidence: result.confidence || null,
      suggestions: result.suggestions || null,
      requiresConfirmation: result.requiresConfirmation || false,
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

