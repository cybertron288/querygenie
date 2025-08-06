/**
 * NextAuth API Route Handler
 * 
 * This route handles all NextAuth authentication endpoints:
 * - /api/auth/signin
 * - /api/auth/signout
 * - /api/auth/callback/[provider]
 * - /api/auth/session
 * - /api/auth/providers
 * - /api/auth/csrf
 */

import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth/config";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };