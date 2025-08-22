/**
 * Workspace Statistics API Routes
 * 
 * Provides analytics and statistics for workspace dashboards
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { 
  memberships, 
  connections, 
  queries,
} from "@/lib/db/schema";
import { workspaceIdParamSchema } from "@/lib/api/validation";
import { eq, and, count, sql, desc, isNull } from "drizzle-orm";
import { checkPermission } from "@/lib/auth/permissions";

/**
 * GET /api/workspaces/[workspaceId]/stats
 * 
 * Get workspace statistics and analytics
 */
export async function GET(
  _request: NextRequest,
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
      "workspace",
      "view"
    );

    if (!hasPermission) {
      return NextResponse.json(
        { error: "Forbidden", message: "Access denied" },
        { status: 403 }
      );
    }

    // Get basic stats in parallel
    const [
      connectionStats,
      memberStats,
      queryStats,
      recentQueries,
    ] = await Promise.all([
      // Connection statistics
      db
        .select({
          total: count(),
          active: sql<number>`count(case when ${connections.isActive} = true then 1 end)`,
        })
        .from(connections)
        .where(
          and(
            eq(connections.workspaceId, workspaceId),
            isNull(connections.deletedAt)
          )
        ),

      // Member statistics  
      db
        .select({
          total: count(),
          active: sql<number>`count(case when ${memberships.isActive} = true then 1 end)`,
        })
        .from(memberships)
        .where(eq(memberships.workspaceId, workspaceId)),

      // Query statistics
      db
        .select({
          total: count(),
          saved: sql<number>`count(case when ${queries.isSaved} = true then 1 end)`,
          shared: sql<number>`count(case when ${queries.isShared} = true then 1 end)`,
        })
        .from(queries)
        .where(
          and(
            eq(queries.workspaceId, workspaceId),
            isNull(queries.deletedAt)
          )
        ),

      // Recent queries with execution data
      db
        .select({
          id: queries.id,
          title: queries.title,
          connectionId: queries.connectionId,
          status: queries.status,
          executionTime: queries.executionTime,
          rowsAffected: queries.rowsAffected,
          createdAt: queries.createdAt,
          updatedAt: queries.updatedAt,
          connectionName: connections.name,
        })
        .from(queries)
        .leftJoin(connections, eq(queries.connectionId, connections.id))
        .where(
          and(
            eq(queries.workspaceId, workspaceId),
            isNull(queries.deletedAt)
          )
        )
        .orderBy(desc(queries.updatedAt))
        .limit(10),
    ]);

    // Calculate query execution trends (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();

    const queryTrends = await db
      .select({
        date: sql<string>`date(${queries.createdAt})`,
        count: count(),
        successCount: sql<number>`count(case when ${queries.status} = 'completed' then 1 end)`,
        errorCount: sql<number>`count(case when ${queries.status} = 'failed' then 1 end)`,
      })
      .from(queries)
      .where(
        and(
          eq(queries.workspaceId, workspaceId),
          sql`${queries.createdAt} >= ${thirtyDaysAgoStr}`,
          isNull(queries.deletedAt)
        )
      )
      .groupBy(sql`date(${queries.createdAt})`)
      .orderBy(sql`date(${queries.createdAt}) desc`)
      .limit(30);

    const stats = {
      connections: {
        total: connectionStats[0]?.total || 0,
        active: connectionStats[0]?.active || 0,
      },
      members: {
        total: memberStats[0]?.total || 0,
        active: memberStats[0]?.active || 0,
      },
      queries: {
        total: queryStats[0]?.total || 0,
        saved: queryStats[0]?.saved || 0,
        shared: queryStats[0]?.shared || 0,
      },
      recentQueries: recentQueries.map(q => ({
        id: q.id,
        title: q.title,
        connection: q.connectionName || 'Unknown',
        status: q.status,
        executionTime: q.executionTime,
        rowsAffected: q.rowsAffected,
        executedAt: q.updatedAt,
      })),
      trends: {
        daily: queryTrends,
        totalThisMonth: queryTrends.reduce((sum, day) => sum + day.count, 0),
        successRate: queryTrends.length > 0 
          ? queryTrends.reduce((sum, day) => sum + day.successCount, 0) / 
            queryTrends.reduce((sum, day) => sum + day.count, 0) * 100
          : 0,
      },
    };

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching workspace stats:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error", 
        message: "Failed to fetch workspace statistics",
      },
      { status: 500 }
    );
  }
}