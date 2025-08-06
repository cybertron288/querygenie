/**
 * Query API Routes
 * 
 * Handles SQL query execution, saving, and AI generation
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { queries, queryExecutions, connections } from "@/lib/db/schema";
import { 
  executeQuerySchema,
  generateQuerySchema,
  paginationSchema,
  workspaceIdParamSchema 
} from "@/lib/api/validation";
import { eq, and, desc, sql } from "drizzle-orm";
import { checkPermission } from "@/lib/auth/permissions";
import { auditLog, createAuditContext } from "@/lib/audit";
import { nanoid } from "nanoid";
import { executeQuery } from "@/lib/db/query-executor";
import { generateSQLQuery } from "@/lib/ai/query-generator";

/**
 * GET /api/workspaces/[workspaceId]/queries
 * 
 * Get saved queries for a workspace
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
      "queries:read"
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

    const filter = searchParams.get("filter"); // saved, shared, mine
    const connectionId = searchParams.get("connectionId");

    const offset = (paginationParams.page - 1) * paginationParams.limit;

    // Build query conditions
    const conditions = [
      eq(queries.workspaceId, workspaceId),
    ];

    if (filter === "saved") {
      conditions.push(eq(queries.isSaved, true));
    } else if (filter === "shared") {
      conditions.push(eq(queries.isShared, true));
    } else if (filter === "mine") {
      conditions.push(eq(queries.createdById, session.user.id));
    }

    if (connectionId) {
      conditions.push(eq(queries.connectionId, connectionId));
    }

    // Get queries
    const workspaceQueries = await db
      .select({
        id: queries.id,
        title: queries.title,
        sqlQuery: queries.sqlQuery,
        description: queries.description,
        connectionId: queries.connectionId,
        isSaved: queries.isSaved,
        isShared: queries.isShared,
        tags: queries.tags,
        createdAt: queries.createdAt,
        createdById: queries.createdById,
      })
      .from(queries)
      .where(and(...conditions))
      .orderBy(desc(queries.createdAt))
      .limit(paginationParams.limit)
      .offset(offset);

    // Get total count
    const [{ count }] = await db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(queries)
      .where(and(...conditions));

    return NextResponse.json({
      data: workspaceQueries,
      pagination: {
        page: paginationParams.page,
        limit: paginationParams.limit,
        total: count,
        pages: Math.ceil(count / paginationParams.limit),
      },
    });
  } catch (error) {
    console.error("Error fetching queries:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "Failed to fetch queries",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workspaces/[workspaceId]/queries
 * 
 * Execute or generate a query
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
      "queries:execute"
    );

    if (!hasPermission) {
      return NextResponse.json(
        { error: "Forbidden", message: "Access denied" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const action = body.action || "execute";

    if (action === "generate") {
      // Generate SQL query using AI
      const validatedData = generateQuerySchema.parse(body);
      
      // Get connection details for schema context
      const [connection] = await db
        .select()
        .from(connections)
        .where(
          and(
            eq(connections.id, validatedData.connectionId),
            eq(connections.workspaceId, workspaceId),
            eq(connections.isActive, true)
          )
        )
        .limit(1);

      if (!connection) {
        return NextResponse.json(
          { error: "Not Found", message: "Connection not found" },
          { status: 404 }
        );
      }

      // Generate SQL query
      const generatedQuery = await generateSQLQuery({
        prompt: validatedData.prompt,
        connectionType: connection.type,
        model: validatedData.model,
        includeExamples: validatedData.includeExamples,
        temperature: validatedData.temperature,
        schema: {}, // TODO: Get actual schema from connection
      });

      // Log audit event
      await auditLog({
        ...createAuditContext(request),
        workspaceId,
        userId: session.user.id,
        action: "query.executed",
        resource: "query",
        metadata: {
          action: "generate",
          model: validatedData.model,
          prompt: validatedData.prompt.substring(0, 100),
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          sqlQuery: generatedQuery.query,
          explanation: generatedQuery.explanation,
          confidence: generatedQuery.confidence,
        },
      });
    } else {
      // Execute SQL query
      const validatedData = executeQuerySchema.parse(body);
      
      // Get connection details
      const [connection] = await db
        .select()
        .from(connections)
        .where(
          and(
            eq(connections.id, validatedData.connectionId),
            eq(connections.workspaceId, workspaceId),
            eq(connections.isActive, true)
          )
        )
        .limit(1);

      if (!connection) {
        return NextResponse.json(
          { error: "Not Found", message: "Connection not found" },
          { status: 404 }
        );
      }

      // Check connection mode for write operations
      const isWriteQuery = /^\s*(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TRUNCATE)/i.test(
        validatedData.sqlQuery
      );
      
      if (isWriteQuery && connection.mode === "read-only") {
        return NextResponse.json(
          {
            error: "Forbidden",
            message: "Write operations not allowed on read-only connection",
          },
          { status: 403 }
        );
      }

      // Create query record
      const queryId = nanoid();
      const executionId = nanoid();

      // Execute the query
      const startTime = new Date();
      const result = await executeQuery({
        connection,
        sqlQuery: validatedData.sqlQuery,
        limit: validatedData.limit,
        timeout: validatedData.timeout,
      });
      const endTime = new Date();

      // Save query and execution records
      await db.transaction(async (tx) => {
        // Save query if requested
        if (validatedData.isSaved) {
          await tx.insert(queries).values({
            id: queryId,
            workspaceId,
            connectionId: validatedData.connectionId,
            title: validatedData.title || "Untitled Query",
            sqlQuery: validatedData.sqlQuery,
            description: validatedData.description,
            isSaved: true,
            isShared: false,
            tags: validatedData.tags,
            createdById: session.user.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }

        // Save execution record
        await tx.insert(queryExecutions).values({
          id: executionId,
          queryId: validatedData.isSaved ? queryId : null,
          workspaceId,
          connectionId: validatedData.connectionId,
          sqlQuery: validatedData.sqlQuery,
          executedById: session.user.id,
          status: result.success ? "success" : "error",
          rowCount: result.rowCount,
          executionTimeMs: endTime.getTime() - startTime.getTime(),
          error: result.error || null,
          createdAt: startTime,
        });
      });

      // Log audit event
      await auditLog({
        ...createAuditContext(request),
        workspaceId,
        userId: session.user.id,
        action: "query.executed",
        resource: "query",
        resourceId: queryId,
        metadata: {
          connectionId: validatedData.connectionId,
          rowCount: result.rowCount,
          executionTimeMs: endTime.getTime() - startTime.getTime(),
          saved: validatedData.isSaved,
        },
      });

      return NextResponse.json({
        success: result.success,
        data: {
          queryId: validatedData.isSaved ? queryId : undefined,
          executionId,
          columns: result.columns,
          rows: result.rows,
          rowCount: result.rowCount,
          executionTimeMs: endTime.getTime() - startTime.getTime(),
        },
        error: result.error,
      });
    }
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

    console.error("Error processing query:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "Failed to process query",
      },
      { status: 500 }
    );
  }
}