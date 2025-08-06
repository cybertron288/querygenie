/**
 * Next.js Edge Middleware
 * 
 * Runs on every request for:
 * - Authentication checks
 * - Authorization (RBAC)
 * - Rate limiting
 * - Security headers
 * - Request logging
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authMiddleware } from "@/lib/auth/middleware";

// Rate limiting store (in-memory for Edge runtime)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Main middleware function
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Add security headers
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  
  // CORS headers for API routes
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const origin = request.headers.get("origin");
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:3000"];
    
    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("Access-Control-Allow-Credentials", "true");
      response.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }
    
    // Handle preflight requests
    if (request.method === "OPTIONS") {
      return new NextResponse(null, { status: 200, headers: response.headers });
    }
    
    // Apply rate limiting for API routes
    const rateLimitResult = await applyRateLimit(request);
    if (!rateLimitResult.allowed) {
      return new NextResponse(
        JSON.stringify({
          error: "Too Many Requests",
          message: "Rate limit exceeded. Please try again later.",
          retryAfter: rateLimitResult.retryAfter,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(rateLimitResult.retryAfter),
            "X-RateLimit-Limit": String(rateLimitResult.limit),
            "X-RateLimit-Remaining": String(rateLimitResult.remaining),
            "X-RateLimit-Reset": String(rateLimitResult.resetTime),
          },
        }
      );
    }
  }
  
  // Apply authentication middleware
  return authMiddleware(request);
}

/**
 * Rate limiting implementation
 */
async function applyRateLimit(request: NextRequest): Promise<{
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}> {
  // Get client identifier (IP or user ID)
  const clientId = 
    request.headers.get("x-forwarded-for") || 
    request.headers.get("x-real-ip") || 
    "unknown";
  
  const now = Date.now();
  const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW || "900000"); // 15 minutes
  const maxRequests = parseInt(process.env.RATE_LIMIT_MAX || "100");
  
  // Clean up expired entries
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
  
  // Get or create rate limit entry
  let entry = rateLimitStore.get(clientId);
  
  if (!entry || entry.resetTime < now) {
    entry = {
      count: 0,
      resetTime: now + windowMs,
    };
    rateLimitStore.set(clientId, entry);
  }
  
  entry.count++;
  
  const allowed = entry.count <= maxRequests;
  const remaining = Math.max(0, maxRequests - entry.count);
  const retryAfter = allowed ? undefined : Math.ceil((entry.resetTime - now) / 1000);
  
  return {
    allowed,
    limit: maxRequests,
    remaining,
    resetTime: entry.resetTime,
    ...(retryAfter !== undefined && { retryAfter }),
  };
}

/**
 * Middleware configuration
 * Specifies which routes the middleware should run on
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)  
     * - favicon.ico, robots.txt, sitemap.xml
     * - public folder
     * - Static files (images, fonts, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|public|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf)$).*)",
  ],
};