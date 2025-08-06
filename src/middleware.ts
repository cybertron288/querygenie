import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/auth/signin",
  },
});

// Configure which routes to protect
// This will protect all routes except the ones listed in the matcher
export const config = {
  matcher: [
    // Protected routes - require authentication
    "/dashboard/:path*",
    "/editor/:path*",
    "/ai/:path*",
    "/connections/:path*",
    "/api-keys/:path*",
    "/workspaces/:path*",
    "/api/ai/:path*",
    "/api/connections/:path*",
    "/api/settings/:path*",
    "/api/workspaces/:path*",
  ],
};