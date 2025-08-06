/**
 * API Validation Schemas
 * 
 * Centralized Zod schemas for API request/response validation
 * Ensures type safety and runtime validation across all endpoints
 */

import { z } from "zod";

// =============================================================================
// Common Schemas
// =============================================================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export const idParamSchema = z.object({
  id: z.string().uuid("Invalid ID format"),
});

export const workspaceIdParamSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID"),
});

// =============================================================================
// User Schemas
// =============================================================================

export const updateUserSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  avatar: z.string().url().optional().nullable(),
});

export const createApiKeySchema = z.object({
  provider: z.enum(["openai", "anthropic", "gemini_pro"]),
  name: z.string().min(1).max(255).optional(),
  apiKey: z.string().min(1),
});

// =============================================================================
// Workspace Schemas
// =============================================================================

export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z
    .string()
    .min(3)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  description: z.string().max(1000).optional().nullable(),
  avatar: z.string().url().optional().nullable(),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional().nullable(),
  avatar: z.string().url().optional().nullable(),
  settings: z.record(z.any()).optional(),
});

export const inviteUserSchema = z.object({
  email: z.string().email(),
  role: z.enum(["owner", "admin", "editor", "viewer"]),
  message: z.string().max(500).optional(),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(["admin", "editor", "viewer"]), // Can't change to owner
});

// =============================================================================
// Connection Schemas
// =============================================================================

export const connectionTypeSchema = z.enum(["postgres", "mysql", "mssql", "sqlite"]);
export const connectionModeSchema = z.enum(["read-only", "read-write"]);

export const createConnectionSchema = z.object({
  name: z.string().min(1).max(255),
  type: connectionTypeSchema,
  mode: connectionModeSchema.default("read-only"),
  host: z.string().min(1).max(255),
  port: z.coerce.number().int().min(1).max(65535),
  database: z.string().min(1).max(255),
  username: z.string().min(1).max(255),
  password: z.string().min(1),
  sslConfig: z
    .object({
      enabled: z.boolean().default(false),
      rejectUnauthorized: z.boolean().default(true),
      ca: z.string().optional(),
      cert: z.string().optional(),
      key: z.string().optional(),
    })
    .optional(),
});

export const updateConnectionSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  mode: connectionModeSchema.optional(),
  host: z.string().min(1).max(255).optional(),
  port: z.coerce.number().int().min(1).max(65535).optional(),
  database: z.string().min(1).max(255).optional(),
  username: z.string().min(1).max(255).optional(),
  password: z.string().min(1).optional(),
  sslConfig: z
    .object({
      enabled: z.boolean().default(false),
      rejectUnauthorized: z.boolean().default(true),
      ca: z.string().optional(),
      cert: z.string().optional(),
      key: z.string().optional(),
    })
    .optional(),
});

// =============================================================================
// Query Schemas
// =============================================================================

export const executeQuerySchema = z.object({
  connectionId: z.string().uuid(),
  sqlQuery: z.string().min(1).max(50000),
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  isSaved: z.boolean().default(false),
  tags: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(10000).default(100),
  timeout: z.coerce.number().int().min(1000).max(60000).default(30000), // ms
});

export const generateQuerySchema = z.object({
  connectionId: z.string().uuid(),
  prompt: z.string().min(1).max(1000),
  model: z.enum(["gemini", "claude", "gpt4"]).optional(),
  includeExamples: z.boolean().default(true),
  temperature: z.number().min(0).max(1).default(0.2),
});

export const updateQuerySchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  isSaved: z.boolean().optional(),
  isShared: z.boolean().optional(),
  tags: z.string().max(500).optional(),
});

// =============================================================================
// Documentation Schemas
// =============================================================================

export const docScopeSchema = z.enum(["workspace", "connection", "schema", "table", "column"]);

export const generateDocSchema = z.object({
  scope: docScopeSchema,
  scopeId: z.string().uuid().optional(),
  title: z.string().min(1).max(255),
  template: z.enum(["technical", "business", "api"]).default("technical"),
  includeExamples: z.boolean().default(true),
  model: z.enum(["gemini", "claude", "gpt4"]).optional(),
});

export const updateDocSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  content: z.string().min(1).max(100000).optional(),
  isPublic: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
});

// =============================================================================
// Response Schemas
// =============================================================================

export const errorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  details: z.array(z.any()).optional(),
  timestamp: z.string().datetime(),
  traceId: z.string().optional(),
});

export const paginatedResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    data: z.array(dataSchema),
    pagination: z.object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
      pages: z.number(),
    }),
  });

export const successResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  data: z.any().optional(),
});

// =============================================================================
// Type Exports
// =============================================================================

export type Pagination = z.infer<typeof paginationSchema>;
export type CreateWorkspace = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspace = z.infer<typeof updateWorkspaceSchema>;
export type InviteUser = z.infer<typeof inviteUserSchema>;
export type CreateConnection = z.infer<typeof createConnectionSchema>;
export type UpdateConnection = z.infer<typeof updateConnectionSchema>;
export type ExecuteQuery = z.infer<typeof executeQuerySchema>;
export type GenerateQuery = z.infer<typeof generateQuerySchema>;
export type UpdateQuery = z.infer<typeof updateQuerySchema>;
export type GenerateDoc = z.infer<typeof generateDocSchema>;
export type UpdateDoc = z.infer<typeof updateDocSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
export type SuccessResponse = z.infer<typeof successResponseSchema>;