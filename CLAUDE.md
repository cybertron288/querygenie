# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development Server
- `npm run dev` - Start development server (uses port 3000 by default, can override with `PORT=3004 npm run dev`)
- `npm run build` - Build for production
- `npm run start` - Start production server

### Database Operations
- `npm run db:generate` - Generate new migrations from schema changes
- `npm run db:migrate` - Apply pending migrations to database
- `npm run db:studio` - Open Drizzle Studio GUI for database management
- `npm run db:seed` - Seed database with sample data (includes test users)
- `npm run db:push` - Push schema changes directly (development only)

### Docker/Local Services
- `npm run local:up` - Start PostgreSQL and Redis containers via Docker Compose
- `npm run local:down` - Stop local services
- `npm run local:reset` - Reset all local data and restart services

### Code Quality
- `npm run lint` / `npm run lint:fix` - ESLint checking and fixing
- `npm run type-check` - TypeScript type checking without build
- `npm run format` - Prettier code formatting
- `npm run test` / `npm run test:watch` - Jest testing

### Complete Setup
- `npm run setup` - Full setup: install dependencies, start services, migrate, and seed

## Architecture Overview

### Technology Stack
- **Framework**: Next.js 14 with App Router
- **Database**: PostgreSQL with Drizzle ORM for type-safe queries
- **Authentication**: NextAuth.js v4 with custom credential provider
- **State Management**: Zustand + React Query (@tanstack/react-query)
- **UI**: Tailwind CSS + Radix UI primitives + shadcn/ui components
- **AI Integration**: Google Gemini (free tier), OpenAI, Anthropic Claude

### Database Schema Architecture
The schema (`src/lib/db/schema.ts`) implements enterprise patterns:
- **Multi-tenant**: Workspaces contain connections, queries, and docs
- **RBAC**: Four workspace roles (owner, admin, editor, viewer) plus global user roles
- **Audit Logging**: Complete activity tracking in `auditLogs` table
- **Soft Deletes**: Most tables have `deletedAt` for data retention
- **Vector Embeddings**: AI-powered semantic search via pgvector extension

Key relationships:
- Users → Workspaces (via Memberships with roles)
- Workspaces → Connections (database connections with encrypted credentials)
- Connections → Queries (saved/executed SQL with AI generation metadata)
- Workspaces → Docs (auto-generated schema documentation)

### Authentication System
- **Custom Password Hashing**: Uses PBKDF2 via `src/lib/encryption.ts` (not bcrypt)
- **Session Strategy**: JWT-based with 30-day expiry
- **Multi-Provider**: Supports credentials, Google OAuth, GitHub OAuth
- **Database Adapter**: Drizzle-based NextAuth adapter
- **API Routes**: `/api/auth/[...nextauth]` handles all auth endpoints

### Core Libraries
- `src/lib/db/` - Database layer with connection pooling and query execution
- `src/lib/auth/` - Authentication, authorization, and RBAC enforcement
- `src/lib/ai/` - AI query generation with multiple provider support
- `src/lib/encryption.ts` - AES-256-GCM for credentials, custom password hashing
- `src/lib/api/validation.ts` - Zod schemas for API request/response validation

### Environment Configuration
The app requires specific environment setup:
- **Database**: `DATABASE_URL` for PostgreSQL connection
- **Auth**: `NEXTAUTH_URL` and `NEXTAUTH_SECRET` for session management
- **Encryption**: `ENCRYPTION_SECRET` for database credential encryption
- **AI Services**: `GEMINI_API_KEY` (required), `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` (optional)

## Critical Implementation Details

### Password Authentication
- Passwords are hashed using custom PBKDF2 implementation in `encryption.ts`
- **Important**: The auth config uses `verifyPassword()` from encryption.ts, not bcryptjs
- Seed script creates test users with password "password123"
- Users table MUST include `password` field (was missing in initial schema)

### Database Migrations
- Schema changes require: modify `schema.ts` → `db:generate` → `db:migrate`
- Development can use `db:push` for rapid iteration
- Production should always use migrations for safety

### Development Port Configuration
- Server runs on port 3000 by default
- When running on different ports, update `NEXTAUTH_URL` in both:
  - `src/lib/env.ts` (fallback value)  
  - `.env.local` file
- PostCSS config (`postcss.config.js`) is required for Tailwind CSS processing

### AI Query Generation
- Primary integration through `src/lib/ai/query-generator.ts`
- Supports multiple providers with fallback strategy
- Queries are saved with generation metadata for analytics

### Multi-tenancy and Permissions
- All data operations are workspace-scoped
- RBAC enforcement happens in API routes and components
- Users can belong to multiple workspaces with different roles
- Audit logging captures all significant actions for compliance

## Common Patterns

### Database Queries
Use Drizzle ORM with the configured db instance from `src/lib/db/index.ts`:
```typescript
import { db } from "@/lib/db";
import { users, workspaces } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const user = await db.query.users.findFirst({
  where: eq(users.email, email)
});
```

### Authentication Checks
Session management through NextAuth:
```typescript
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";

const session = await getServerSession(authOptions);
if (!session?.user) {
  return new Response("Unauthorized", { status: 401 });
}
```

### API Route Structure
- RESTful endpoints under `/api/workspaces/[workspaceId]/`
- Request validation using Zod schemas from `src/lib/api/validation.ts`
- Error handling with consistent response formats
- RBAC middleware for workspace access control

## Test Credentials
After running `npm run db:seed`:
- **Admin**: admin@querygenie.ai / password123
- **Users**: john@example.com, jane@example.com, bob@example.com / password123