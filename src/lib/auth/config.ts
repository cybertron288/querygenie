/**
 * NextAuth.js Configuration
 * 
 * Enterprise-grade authentication with:
 * - Multiple OAuth providers
 * - Role-based access control
 * - Session management
 * - JWT with refresh tokens
 * - Audit logging
 */

import { NextAuthOptions } from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import { verifyPassword } from "@/lib/encryption";
import { db } from "@/lib/db";
import { users, accounts, sessions, memberships, workspaces, auditLogs } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { eq, and, sql } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import type { User } from "next-auth";
import type { JWT } from "next-auth/jwt";

/**
 * Module augmentation for NextAuth types
 * Adds custom fields to User and Session
 */
declare module "next-auth" {
  interface User {
    id: string;
    role: "admin" | "developer" | "analyst";
    isActive: boolean;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string | null;
      image: string | null;
      role: "admin" | "developer" | "analyst";
      isActive: boolean;
    };
    workspaces: Array<{
      id: string;
      name: string;
      slug: string;
      role: "owner" | "admin" | "editor" | "viewer";
    }>;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "admin" | "developer" | "analyst";
    isActive: boolean;
  }
}

/**
 * NextAuth configuration
 */
export const authOptions: NextAuthOptions = {
  // Database adapter for persisting users
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
  }),

  // Session configuration
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },

  // JWT configuration
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  // Pages configuration
  pages: {
    signIn: "/auth/signin",
    signOut: "/auth/signout",
    error: "/auth/error",
    verifyRequest: "/auth/verify",
    newUser: "/onboarding",
  },

  // Authentication providers
  providers: [
    // Google OAuth
    GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),

    // GitHub OAuth
    GitHubProvider({
      clientId: env.GITHUB_CLIENT_ID ?? "",
      clientSecret: env.GITHUB_CLIENT_SECRET ?? "",
      allowDangerousEmailAccountLinking: true,
    }),

    // Email/Password credentials
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: {
          label: "Email",
          type: "email",
          placeholder: "john@example.com",
        },
        password: {
          label: "Password",
          type: "password",
        },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        // Find user by email
        const user = await db.query.users.findFirst({
          where: eq(users.email, credentials.email.toLowerCase()),
        });

        if (!user) {
          throw new Error("Invalid email or password");
        }

        // Check if user is active
        if (!user.isActive) {
          throw new Error("Account is disabled. Please contact support.");
        }

        // For OAuth users, password will be null
        if (!user.password) {
          throw new Error("Please sign in with your social account");
        }

        // Verify password
        const isPasswordValid = await verifyPassword(credentials.password, user.password);

        if (!isPasswordValid) {
          throw new Error("Invalid email or password");
        }

        // Update last login
        await db
          .update(users)
          .set({ lastLoginAt: new Date() })
          .where(eq(users.id, user.id));

        // Log successful login
        await logAuditEvent({
          userId: user.id,
          action: "login",
          resource: "users",
          resourceId: user.id,
          metadata: {
            provider: "credentials",
          },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatar,
          role: user.role ?? "developer",
          isActive: user.isActive,
        };
      },
    }),
  ],

  // Callbacks for customizing authentication flow
  callbacks: {
    // Sign in callback - validate user can sign in
    async signIn({ user, account, profile }) {
      // Check if user is active
      if (user.email) {
        const existingUser = await db.query.users.findFirst({
          where: eq(users.email, user.email),
        });

        if (existingUser && !existingUser.isActive) {
          return false; // Prevent sign in
        }

        // Update last login
        if (existingUser) {
          await db
            .update(users)
            .set({ lastLoginAt: new Date() })
            .where(eq(users.id, existingUser.id));
        }
      }

      return true;
    },

    // JWT callback - add custom fields to token
    async jwt({ token, user, account, trigger, session }) {
      // Initial sign in
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.isActive = user.isActive;
      }

      // Update token from new session data
      if (trigger === "update" && session) {
        token.name = session.name;
        token.email = session.email;
      }

      // Refresh user data periodically
      if (token.id && trigger === "update") {
        const dbUser = await db.query.users.findFirst({
          where: eq(users.id, token.id as string),
        });

        if (dbUser) {
          token.role = dbUser.role ?? "developer";
          token.isActive = dbUser.isActive;
        }
      }

      return token;
    },

    // Session callback - add custom fields to session
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role ?? "developer";
        session.user.isActive = token.isActive ?? true;

        // Fetch user's workspaces with roles
        const userMemberships = await db
          .select({
            workspaceId: memberships.workspaceId,
            workspaceName: workspaces.name,
            workspaceSlug: workspaces.slug,
            role: memberships.role,
          })
          .from(memberships)
          .innerJoin(workspaces, eq(memberships.workspaceId, workspaces.id))
          .where(
            and(
              eq(memberships.userId, token.id as string),
              eq(memberships.isActive, true),
              eq(workspaces.isActive, true)
            )
          );

        session.workspaces = userMemberships.map((m) => ({
          id: m.workspaceId,
          name: m.workspaceName,
          slug: m.workspaceSlug,
          role: m.role,
        }));
      }

      return session;
    },

    // Redirect callback - customize redirects
    async redirect({ url, baseUrl }) {
      // Allows relative callback URLs
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) {
        return url;
      }
      return baseUrl;
    },
  },

  // Events for logging and side effects
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      if (user.id) {
        await logAuditEvent({
          userId: user.id,
          action: "login",
          resource: "users",
          resourceId: user.id,
          metadata: {
            provider: account?.provider,
            isNewUser,
          },
        });
      }
    },

    async signOut({ session, token }) {
      const userId = (token as JWT)?.id || (session as any)?.user?.id;
      if (userId) {
        await logAuditEvent({
          userId: userId as string,
          action: "logout",
          resource: "users",
          resourceId: userId as string,
          metadata: {},
        });
      }
    },

    async createUser({ user }) {
      // Create default workspace for new user
      const workspaceId = generateId();
      const workspaceSlug = `${user.email?.split("@")[0]}-workspace`.toLowerCase();

      await db.insert(workspaces).values({
        id: workspaceId,
        name: `${user.name || user.email?.split("@")[0]}'s Workspace`,
        slug: workspaceSlug,
        ownerId: user.id,
        isActive: true,
        settings: {
          defaultConnectionMode: "read-only",
          aiProvider: "gemini",
        },
      });

      // Add user as owner of workspace
      await db.insert(memberships).values({
        userId: user.id,
        workspaceId,
        role: "owner",
        isActive: true,
      });

      // Log user creation
      await logAuditEvent({
        userId: user.id,
        action: "create",
        resource: "users",
        resourceId: user.id,
        metadata: {
          email: user.email,
        },
      });
    },

    async linkAccount({ user, account, profile }) {
      if (user.id) {
        await logAuditEvent({
          userId: user.id,
          action: "update",
          resource: "accounts",
          resourceId: account.providerAccountId,
          metadata: {
            provider: account.provider,
          },
        });
      }
    },

    async session({ session, token }) {
      // Can be used to track active sessions
    },
  },

  // Debug mode for development
  debug: env.NODE_ENV === "development",
};

/**
 * Helper function to log audit events
 */
async function logAuditEvent({
  userId,
  workspaceId,
  action,
  resource,
  resourceId,
  metadata = {},
}: {
  userId: string;
  workspaceId?: string;
  action: "create" | "read" | "update" | "delete" | "login" | "logout";
  resource: string;
  resourceId?: string;
  metadata?: Record<string, any>;
}) {
  try {
    await db.insert(auditLogs).values({
      userId,
      workspaceId,
      action,
      resource,
      resourceId,
      metadata,
      userAgent: metadata.userAgent,
      ipAddress: metadata.ipAddress,
      sessionId: metadata.sessionId,
    });
  } catch (error) {
    console.error("Failed to log audit event:", error);
    // Don't throw - audit logging should not break the app
  }
}