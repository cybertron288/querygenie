/**
 * Authentication & Authorization Middleware
 * 
 * Enterprise-grade middleware for:
 * - Route protection
 * - Role-based access control (RBAC)
 * - Workspace context validation
 * - API rate limiting
 * - Request logging
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { db } from "@/lib/db";
import { memberships, workspaces, auditLogs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * Route configuration with required roles
 */
const ROUTE_CONFIG = {
  // Public routes (no auth required)
  public: [
    "/",
    "/auth/signin",
    "/auth/signup",
    "/auth/error",
    "/auth/verify",
    "/api/health",
  ],

  // Authenticated routes (any authenticated user)
  authenticated: [
    "/dashboard",
    "/profile",
    "/api/users/me",
  ],

  // Workspace routes with role requirements
  workspace: {
    // Owner only routes
    owner: [
      "/api/workspaces/:workspaceId/delete",
      "/api/workspaces/:workspaceId/transfer",
    ],
    
    // Admin+ routes (owner, admin)
    admin: [
      "/api/workspaces/:workspaceId/settings",
      "/api/workspaces/:workspaceId/connections",
      "/api/workspaces/:workspaceId/members",
      "/api/workspaces/:workspaceId/invitations",
    ],
    
    // Editor+ routes (owner, admin, editor)
    editor: [
      "/api/workspaces/:workspaceId/queries/execute",
      "/api/workspaces/:workspaceId/queries/generate",
      "/api/workspaces/:workspaceId/docs/create",
      "/api/workspaces/:workspaceId/docs/edit",
    ],
    
    // Viewer+ routes (all authenticated workspace members)
    viewer: [
      "/api/workspaces/:workspaceId",
      "/api/workspaces/:workspaceId/queries",
      "/api/workspaces/:workspaceId/docs",
      "/api/workspaces/:workspaceId/schema",
    ],
  },

  // System admin only routes
  systemAdmin: [
    "/admin",
    "/api/admin",
  ],
};

/**
 * Role hierarchy for permission checking
 */
const ROLE_HIERARCHY = {
  owner: ["owner", "admin", "editor", "viewer"],
  admin: ["admin", "editor", "viewer"],
  editor: ["editor", "viewer"],
  viewer: ["viewer"],
};

/**
 * Main authentication middleware
 */
export async function authMiddleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const method = request.method;

  // Check if route is public
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Get JWT token
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Check if user is authenticated
  if (!token) {
    return redirectToSignIn(request);
  }

  // Check if user is active
  if (!token.isActive) {
    return new NextResponse(
      JSON.stringify({
        error: "Account is disabled",
        message: "Your account has been disabled. Please contact support.",
      }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Check system admin routes
  if (isSystemAdminRoute(pathname) && token.role !== "admin") {
    return new NextResponse(
      JSON.stringify({
        error: "Forbidden",
        message: "System admin access required",
      }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Check workspace routes
  const workspaceId = extractWorkspaceId(pathname);
  if (workspaceId) {
    const hasAccess = await checkWorkspaceAccess(
      token.id as string,
      workspaceId,
      pathname,
      method
    );

    if (!hasAccess) {
      return new NextResponse(
        JSON.stringify({
          error: "Forbidden",
          message: "You don't have permission to access this resource",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Add workspace context to headers
    const response = NextResponse.next();
    response.headers.set("X-Workspace-Id", workspaceId);
    
    // Log API access for audit
    if (pathname.startsWith("/api/")) {
      await logApiAccess(token.id as string, workspaceId, pathname, method);
    }

    return response;
  }

  // Add user context to headers
  const response = NextResponse.next();
  response.headers.set("X-User-Id", token.id as string);
  response.headers.set("X-User-Role", token.role as string);

  return response;
}

/**
 * Check if route is public
 */
function isPublicRoute(pathname: string): boolean {
  return ROUTE_CONFIG.public.some((route) => {
    if (route.includes("*")) {
      const routePattern = route.replace("*", "");
      return pathname.startsWith(routePattern);
    }
    return pathname === route;
  });
}

/**
 * Check if route requires system admin
 */
function isSystemAdminRoute(pathname: string): boolean {
  return ROUTE_CONFIG.systemAdmin.some((route) =>
    pathname.startsWith(route)
  );
}

/**
 * Extract workspace ID from pathname
 */
function extractWorkspaceId(pathname: string): string | null {
  const match = pathname.match(/\/workspaces\/([a-f0-9-]+)/);
  return match ? match[1] : null;
}

/**
 * Check if user has access to workspace route
 */
async function checkWorkspaceAccess(
  userId: string,
  workspaceId: string,
  pathname: string,
  method: string
): Promise<boolean> {
  // Get user's role in workspace
  const membership = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.userId, userId),
      eq(memberships.workspaceId, workspaceId),
      eq(memberships.isActive, true)
    ),
  });

  if (!membership) {
    return false; // User is not a member of the workspace
  }

  const userRole = membership.role;

  // Check route-specific permissions
  const requiredRole = getRequiredRole(pathname, method);
  if (!requiredRole) {
    return true; // No specific role required
  }

  // Check if user's role has required permission
  return hasPermission(userRole, requiredRole);
}

/**
 * Get required role for a route
 */
function getRequiredRole(
  pathname: string,
  method: string
): "owner" | "admin" | "editor" | "viewer" | null {
  // Check owner routes
  if (matchesRoutePattern(pathname, ROUTE_CONFIG.workspace.owner)) {
    return "owner";
  }

  // Check admin routes
  if (matchesRoutePattern(pathname, ROUTE_CONFIG.workspace.admin)) {
    return "admin";
  }

  // Check editor routes (with method-specific checks)
  if (matchesRoutePattern(pathname, ROUTE_CONFIG.workspace.editor)) {
    // Read operations can be done by viewers
    if (method === "GET") {
      return "viewer";
    }
    return "editor";
  }

  // Check viewer routes
  if (matchesRoutePattern(pathname, ROUTE_CONFIG.workspace.viewer)) {
    return "viewer";
  }

  return null;
}

/**
 * Check if pathname matches route pattern
 */
function matchesRoutePattern(pathname: string, routes: string[]): boolean {
  return routes.some((route) => {
    // Replace :param with regex pattern
    const pattern = route
      .replace(/:workspaceId/g, "[a-f0-9-]+")
      .replace(/:[\w]+/g, "[^/]+");
    
    const regex = new RegExp(`^${pattern}$`);
    return regex.test(pathname);
  });
}

/**
 * Check if user role has required permission
 */
function hasPermission(
  userRole: "owner" | "admin" | "editor" | "viewer",
  requiredRole: "owner" | "admin" | "editor" | "viewer"
): boolean {
  const permissions = ROLE_HIERARCHY[userRole];
  return permissions.includes(requiredRole);
}

/**
 * Redirect to sign in page
 */
function redirectToSignIn(request: NextRequest) {
  const signInUrl = new URL("/auth/signin", request.url);
  signInUrl.searchParams.set("callbackUrl", request.url);
  
  // Return JSON for API routes
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return new NextResponse(
      JSON.stringify({
        error: "Unauthorized",
        message: "Authentication required",
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
  
  // Redirect for web routes
  return NextResponse.redirect(signInUrl);
}

/**
 * Log API access for audit
 */
async function logApiAccess(
  userId: string,
  workspaceId: string,
  pathname: string,
  method: string
) {
  try {
    // Only log write operations and sensitive reads
    const shouldLog = 
      method !== "GET" || 
      pathname.includes("/connections") ||
      pathname.includes("/members") ||
      pathname.includes("/settings");

    if (shouldLog) {
      await db.insert(auditLogs).values({
        userId,
        workspaceId,
        action: method === "GET" ? "read" : 
                method === "POST" ? "create" :
                method === "PUT" || method === "PATCH" ? "update" :
                method === "DELETE" ? "delete" : "read",
        resource: pathname,
        metadata: {
          method,
          timestamp: new Date().toISOString(),
        },
      });
    }
  } catch (error) {
    console.error("Failed to log API access:", error);
    // Don't throw - logging should not break the request
  }
}

/**
 * Export middleware config for Next.js
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};