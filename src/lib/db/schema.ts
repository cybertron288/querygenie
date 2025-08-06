/**
 * Database Schema Definition
 * 
 * Complete schema for QueryGenie with enterprise-grade design:
 * - RBAC (Role-Based Access Control)
 * - Audit logging
 * - Soft deletes
 * - Timestamps for all tables
 * - Proper indexes for performance
 * - Foreign key relationships with cascading
 * 
 * Using Drizzle ORM for type-safety and performance
 */

import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  vector,
  unique,
  primaryKey,
} from "drizzle-orm/pg-core";

// =============================================================================
// Enums
// =============================================================================

export const userRoleEnum = pgEnum("user_role", ["admin", "developer", "analyst"]);

export const workspaceRoleEnum = pgEnum("workspace_role", [
  "owner", 
  "admin", 
  "editor", 
  "viewer"
]);

export const connectionTypeEnum = pgEnum("connection_type", [
  "postgres", 
  "mysql", 
  "mssql", 
  "sqlite"
]);

export const connectionModeEnum = pgEnum("connection_mode", [
  "read-only", 
  "read-write"
]);

export const queryStatusEnum = pgEnum("query_status", [
  "pending",
  "running", 
  "completed", 
  "failed", 
  "cancelled"
]);

export const docScopeEnum = pgEnum("doc_scope", [
  "workspace",
  "connection", 
  "schema", 
  "table", 
  "column"
]);

export const messageRoleEnum = pgEnum("message_role", [
  "user",
  "assistant", 
  "system"
]);

export const auditActionEnum = pgEnum("audit_action", [
  "create", 
  "read", 
  "update", 
  "delete",
  "login",
  "logout",
  "invite",
  "remove",
  "execute_query",
  "generate_docs",
  "export_data"
]);

export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted", 
  "declined", 
  "expired"
]);

// =============================================================================
// Core Tables
// =============================================================================

/**
 * Users table - Core user information
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  password: text("password"), // Hashed password for credentials login
  avatar: text("avatar"), // URL to avatar image
  role: userRoleEnum("role").default("developer"),
  emailVerified: timestamp("email_verified"),
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"), // Soft delete
}, (table) => ({
  emailIdx: index("users_email_idx").on(table.email),
  activeIdx: index("users_active_idx").on(table.isActive),
  createdAtIdx: index("users_created_at_idx").on(table.createdAt),
}));

/**
 * Accounts table - OAuth provider accounts
 * NextAuth.js compatible
 */
export const accounts = pgTable("accounts", {
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 255 }).notNull(),
  provider: varchar("provider", { length: 255 }).notNull(),
  providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(),
  refreshToken: text("refresh_token"),
  accessToken: text("access_token"),
  expiresAt: integer("expires_at"),
  tokenType: varchar("token_type", { length: 255 }),
  scope: varchar("scope", { length: 255 }),
  idToken: text("id_token"),
  sessionState: varchar("session_state", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  compoundKey: primaryKey({
    columns: [table.provider, table.providerAccountId],
  }),
  userIdIdx: index("accounts_user_id_idx").on(table.userId),
}));

/**
 * Sessions table - User sessions
 * NextAuth.js compatible
 */
export const sessions = pgTable("sessions", {
  sessionToken: varchar("session_token", { length: 255 }).primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("sessions_user_id_idx").on(table.userId),
  expiresIdx: index("sessions_expires_idx").on(table.expires),
}));

/**
 * Workspaces table - Team collaboration spaces
 */
export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
  avatar: text("avatar"), // URL to workspace logo
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  isActive: boolean("is_active").default(true),
  settings: jsonb("settings").default({}), // Workspace preferences
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"), // Soft delete
}, (table) => ({
  slugIdx: index("workspaces_slug_idx").on(table.slug),
  ownerIdx: index("workspaces_owner_id_idx").on(table.ownerId),
  activeIdx: index("workspaces_active_idx").on(table.isActive),
}));

/**
 * Workspace memberships - User roles within workspaces
 */
export const memberships = pgTable("memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  role: workspaceRoleEnum("role").notNull(),
  isActive: boolean("is_active").default(true),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userWorkspaceIdx: unique("memberships_user_workspace_unique").on(
    table.userId, 
    table.workspaceId
  ),
  userIdx: index("memberships_user_id_idx").on(table.userId),
  workspaceIdx: index("memberships_workspace_id_idx").on(table.workspaceId),
  roleIdx: index("memberships_role_idx").on(table.role),
}));

/**
 * Workspace invitations
 */
export const invitations = pgTable("invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 255 }).notNull(),
  role: workspaceRoleEnum("role").notNull(),
  status: invitationStatusEnum("status").default("pending"),
  invitedById: uuid("invited_by_id")
    .references(() => users.id, { onDelete: "set null" }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  tokenIdx: index("invitations_token_idx").on(table.token),
  emailIdx: index("invitations_email_idx").on(table.email),
  workspaceEmailIdx: unique("invitations_workspace_email_unique").on(
    table.workspaceId, 
    table.email
  ),
  statusIdx: index("invitations_status_idx").on(table.status),
  expiresIdx: index("invitations_expires_at_idx").on(table.expiresAt),
}));

// =============================================================================
// Database Connection Tables
// =============================================================================

/**
 * Database connections
 */
export const connections = pgTable("connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  type: connectionTypeEnum("type").notNull(),
  mode: connectionModeEnum("mode").default("read-only"),
  host: varchar("host", { length: 255 }),
  port: integer("port"),
  database: varchar("database", { length: 255 }),
  username: varchar("username", { length: 255 }),
  encryptedCredentials: text("encrypted_credentials"), // Encrypted password/connection string
  sslConfig: jsonb("ssl_config").default({}),
  isActive: boolean("is_active").default(true),
  lastConnectedAt: timestamp("last_connected_at"),
  createdById: uuid("created_by_id")
    .references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"), // Soft delete
}, (table) => ({
  workspaceIdx: index("connections_workspace_id_idx").on(table.workspaceId),
  typeIdx: index("connections_type_idx").on(table.type),
  activeIdx: index("connections_active_idx").on(table.isActive),
  workspaceNameIdx: unique("connections_workspace_name_unique").on(
    table.workspaceId, 
    table.name
  ),
}));

/**
 * Database schemas (snapshots)
 */
export const schemas = pgTable("schemas", {
  id: uuid("id").primaryKey().defaultRandom(),
  connectionId: uuid("connection_id")
    .notNull()
    .references(() => connections.id, { onDelete: "cascade" }),
  version: varchar("version", { length: 50 }).notNull(), // Schema version/hash
  schemaData: jsonb("schema_data").notNull(), // Complete schema structure
  tableCount: integer("table_count").default(0),
  isActive: boolean("is_active").default(true),
  ingestedAt: timestamp("ingested_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  connectionIdx: index("schemas_connection_id_idx").on(table.connectionId),
  versionIdx: index("schemas_version_idx").on(table.version),
  activeIdx: index("schemas_active_idx").on(table.isActive),
  connectionVersionIdx: unique("schemas_connection_version_unique").on(
    table.connectionId, 
    table.version
  ),
}));

/**
 * Database tables metadata
 */
export const tables = pgTable("tables", {
  id: uuid("id").primaryKey().defaultRandom(),
  schemaId: uuid("schema_id")
    .notNull()
    .references(() => schemas.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  schemaName: varchar("schema_name", { length: 255 }), // Database schema name
  type: varchar("type", { length: 50 }).default("table"), // table, view, materialized_view
  description: text("description"),
  columnCount: integer("column_count").default(0),
  estimatedRowCount: integer("estimated_row_count"),
  metadata: jsonb("metadata").default({}), // Additional table info
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  schemaIdx: index("tables_schema_id_idx").on(table.schemaId),
  nameIdx: index("tables_name_idx").on(table.name),
  typeIdx: index("tables_type_idx").on(table.type),
  schemNameIdx: unique("tables_schema_name_unique").on(
    table.schemaId, 
    table.schemaName,
    table.name
  ),
}));

/**
 * Table columns metadata
 */
export const columns = pgTable("columns", {
  id: uuid("id").primaryKey().defaultRandom(),
  tableId: uuid("table_id")
    .notNull()
    .references(() => tables.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  dataType: varchar("data_type", { length: 100 }).notNull(),
  isNullable: boolean("is_nullable").default(true),
  isPrimaryKey: boolean("is_primary_key").default(false),
  isForeignKey: boolean("is_foreign_key").default(false),
  isUnique: boolean("is_unique").default(false),
  hasIndex: boolean("has_index").default(false),
  defaultValue: text("default_value"),
  maxLength: integer("max_length"),
  precision: integer("precision"),
  scale: integer("scale"),
  position: integer("position").notNull(), // Column order
  description: text("description"),
  metadata: jsonb("metadata").default({}),
}, (table) => ({
  tableIdx: index("columns_table_id_idx").on(table.tableId),
  nameIdx: index("columns_name_idx").on(table.name),
  dataTypeIdx: index("columns_data_type_idx").on(table.dataType),
  pkIdx: index("columns_is_primary_key_idx").on(table.isPrimaryKey),
  fkIdx: index("columns_is_foreign_key_idx").on(table.isForeignKey),
  tableNameIdx: unique("columns_table_name_unique").on(
    table.tableId, 
    table.name
  ),
}));

// =============================================================================
// Query & AI Tables
// =============================================================================

/**
 * Query history and saved queries
 */
export const queries = pgTable("queries", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  connectionId: uuid("connection_id")
    .references(() => connections.id, { onDelete: "set null" }),
  title: varchar("title", { length: 255 }),
  description: text("description"),
  prompt: text("prompt"), // Natural language prompt
  sqlQuery: text("sql_query").notNull(),
  status: queryStatusEnum("status").default("completed"),
  executionTime: integer("execution_time"), // Milliseconds
  rowsAffected: integer("rows_affected"),
  errorMessage: text("error_message"),
  isShared: boolean("is_shared").default(false),
  isSaved: boolean("is_saved").default(false),
  tags: varchar("tags", { length: 500 }), // Comma-separated tags
  metadata: jsonb("metadata").default({}), // Query plan, optimization info
  createdById: uuid("created_by_id")
    .references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"), // Soft delete
}, (table) => ({
  workspaceIdx: index("queries_workspace_id_idx").on(table.workspaceId),
  connectionIdx: index("queries_connection_id_idx").on(table.connectionId),
  createdByIdx: index("queries_created_by_id_idx").on(table.createdById),
  statusIdx: index("queries_status_idx").on(table.status),
  sharedIdx: index("queries_is_shared_idx").on(table.isShared),
  savedIdx: index("queries_is_saved_idx").on(table.isSaved),
  createdAtIdx: index("queries_created_at_idx").on(table.createdAt),
  titleIdx: index("queries_title_idx").on(table.title),
}));

/**
 * Query executions (for analytics and debugging)
 */
export const queryExecutions = pgTable("query_executions", {
  id: uuid("id").primaryKey().defaultRandom(),
  queryId: uuid("query_id")
    .notNull()
    .references(() => queries.id, { onDelete: "cascade" }),
  executedById: uuid("executed_by_id")
    .references(() => users.id, { onDelete: "set null" }),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  duration: integer("duration"), // Milliseconds
  rowCount: integer("row_count"),
  status: queryStatusEnum("status").notNull(),
  errorMessage: text("error_message"),
  executionPlan: jsonb("execution_plan"), // Database execution plan
  serverInfo: jsonb("server_info"), // Database server information
}, (table) => ({
  queryIdx: index("query_executions_query_id_idx").on(table.queryId),
  executedByIdx: index("query_executions_executed_by_id_idx").on(table.executedById),
  statusIdx: index("query_executions_status_idx").on(table.status),
  startedAtIdx: index("query_executions_started_at_idx").on(table.startedAt),
}));

// =============================================================================
// Documentation Tables
// =============================================================================

/**
 * Generated documentation
 */
export const docs = pgTable("docs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  scope: docScopeEnum("scope").notNull(),
  scopeId: uuid("scope_id"), // ID of the scoped resource
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(), // Markdown content
  template: varchar("template", { length: 100 }), // Template used
  isPublic: boolean("is_public").default(false),
  version: integer("version").default(1),
  metadata: jsonb("metadata").default({}),
  generatedById: uuid("generated_by_id")
    .references(() => users.id, { onDelete: "set null" }),
  lastEditedById: uuid("last_edited_by_id")
    .references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"), // Soft delete
}, (table) => ({
  workspaceIdx: index("docs_workspace_id_idx").on(table.workspaceId),
  scopeIdx: index("docs_scope_idx").on(table.scope),
  scopeIdIdx: index("docs_scope_id_idx").on(table.scopeId),
  publicIdx: index("docs_is_public_idx").on(table.isPublic),
  generatedByIdx: index("docs_generated_by_id_idx").on(table.generatedById),
  titleIdx: index("docs_title_idx").on(table.title),
  updatedAtIdx: index("docs_updated_at_idx").on(table.updatedAt),
}));

// =============================================================================
// AI Conversation Tables
// =============================================================================

/**
 * AI conversation threads (one per database connection)
 */
export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  connectionId: uuid("connection_id")
    .notNull()
    .references(() => connections.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  messageCount: integer("message_count").default(0),
  lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
  createdById: uuid("created_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"), // Soft delete
}, (table) => ({
  workspaceIdx: index("conversations_workspace_id_idx").on(table.workspaceId),
  connectionIdx: index("conversations_connection_id_idx").on(table.connectionId),
  createdByIdx: index("conversations_created_by_id_idx").on(table.createdById),
  lastActivityIdx: index("conversations_last_activity_idx").on(table.lastActivityAt),
  activeIdx: index("conversations_active_idx").on(table.isActive),
  // Ensure one active conversation per connection per user
  uniqueActivePerConnection: unique("conversations_connection_user_active_unique").on(
    table.connectionId, 
    table.createdById,
    table.isActive
  ),
}));

/**
 * AI conversation messages
 */
export const aiMessages = pgTable("ai_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: messageRoleEnum("role").notNull(),
  content: text("content").notNull(),
  sqlQuery: text("sql_query"), // Generated SQL (if role is assistant)
  explanation: text("explanation"), // AI explanation of the query
  confidence: integer("confidence"), // AI confidence score (0-100)
  executionTime: integer("execution_time"), // Query execution time in ms
  rowsAffected: integer("rows_affected"), // Number of rows returned/affected
  error: text("error"), // Error message if query failed
  metadata: jsonb("metadata").default({}), // Additional data (tokens used, model, etc.)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  conversationIdx: index("ai_messages_conversation_id_idx").on(table.conversationId),
  roleIdx: index("ai_messages_role_idx").on(table.role),
  createdAtIdx: index("ai_messages_created_at_idx").on(table.createdAt),
  sqlQueryIdx: index("ai_messages_sql_query_idx").on(table.sqlQuery),
}));

// =============================================================================
// Vector Storage for AI
// =============================================================================

/**
 * Embeddings for semantic search and RAG
 */
export const embeddings = pgTable("embeddings", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  sourceType: varchar("source_type", { length: 50 }).notNull(), // schema, table, column, query, doc
  sourceId: uuid("source_id").notNull(),
  content: text("content").notNull(), // Text that was embedded
  embedding: vector("embedding", { dimensions: 1536 }), // OpenAI embedding size
  model: varchar("model", { length: 100 }).default("text-embedding-3-large"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  workspaceIdx: index("embeddings_workspace_id_idx").on(table.workspaceId),
  sourceTypeIdx: index("embeddings_source_type_idx").on(table.sourceType),
  sourceIdIdx: index("embeddings_source_id_idx").on(table.sourceId),
  // Vector similarity index (requires pgvector extension)
  embeddingIdx: index("embeddings_embedding_idx").using(
    "ivfflat", 
    table.embedding.op("vector_cosine_ops")
  ),
  workspaceSourceIdx: unique("embeddings_workspace_source_unique").on(
    table.workspaceId,
    table.sourceType, 
    table.sourceId
  ),
}));

// =============================================================================
// User API Keys
// =============================================================================

/**
 * User API keys for external services
 */
export const userApiKeys = pgTable("user_api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 50 }).notNull(), // openai, anthropic, gemini_pro
  name: varchar("name", { length: 255 }), // User-defined name
  encryptedKey: text("encrypted_key").notNull(),
  keyHash: varchar("key_hash", { length: 255 }).notNull(), // For validation
  isActive: boolean("is_active").default(true),
  lastUsedAt: timestamp("last_used_at"),
  usageCount: integer("usage_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("user_api_keys_user_id_idx").on(table.userId),
  providerIdx: index("user_api_keys_provider_idx").on(table.provider),
  activeIdx: index("user_api_keys_is_active_idx").on(table.isActive),
  userProviderIdx: unique("user_api_keys_user_provider_unique").on(
    table.userId, 
    table.provider
  ),
  hashIdx: index("user_api_keys_key_hash_idx").on(table.keyHash),
}));

// =============================================================================
// Audit & Activity Logging
// =============================================================================

/**
 * Audit log for compliance and security
 */
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .references(() => workspaces.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "set null" }),
  action: auditActionEnum("action").notNull(),
  resource: varchar("resource", { length: 100 }).notNull(), // Table name
  resourceId: uuid("resource_id"), // ID of the resource
  oldValues: jsonb("old_values"), // Previous values (for updates)
  newValues: jsonb("new_values"), // New values
  userAgent: text("user_agent"),
  ipAddress: varchar("ip_address", { length: 45 }), // IPv4/IPv6
  sessionId: varchar("session_id", { length: 255 }),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  workspaceIdx: index("audit_logs_workspace_id_idx").on(table.workspaceId),
  userIdx: index("audit_logs_user_id_idx").on(table.userId),
  actionIdx: index("audit_logs_action_idx").on(table.action),
  resourceIdx: index("audit_logs_resource_idx").on(table.resource),
  resourceIdIdx: index("audit_logs_resource_id_idx").on(table.resourceId),
  createdAtIdx: index("audit_logs_created_at_idx").on(table.createdAt),
  ipAddressIdx: index("audit_logs_ip_address_idx").on(table.ipAddress),
}));

// =============================================================================
// Relations
// =============================================================================

// User relations
export const usersRelations = relations(users, ({ many, one }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  ownedWorkspaces: many(workspaces, { relationName: "workspace_owner" }),
  memberships: many(memberships),
  createdConnections: many(connections, { relationName: "connection_creator" }),
  createdQueries: many(queries, { relationName: "query_creator" }),
  executedQueries: many(queryExecutions, { relationName: "query_executor" }),
  generatedDocs: many(docs, { relationName: "doc_generator" }),
  editedDocs: many(docs, { relationName: "doc_editor" }),
  apiKeys: many(userApiKeys),
  auditLogs: many(auditLogs),
  sentInvitations: many(invitations, { relationName: "invitation_sender" }),
}));

// Account relations
export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

// Session relations
export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

// Workspace relations
export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, {
    fields: [workspaces.ownerId],
    references: [users.id],
    relationName: "workspace_owner",
  }),
  memberships: many(memberships),
  connections: many(connections),
  queries: many(queries),
  docs: many(docs),
  embeddings: many(embeddings),
  auditLogs: many(auditLogs),
  invitations: many(invitations),
}));

// Membership relations
export const membershipsRelations = relations(memberships, ({ one }) => ({
  user: one(users, {
    fields: [memberships.userId],
    references: [users.id],
  }),
  workspace: one(workspaces, {
    fields: [memberships.workspaceId],
    references: [workspaces.id],
  }),
}));

// Invitation relations
export const invitationsRelations = relations(invitations, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [invitations.workspaceId],
    references: [workspaces.id],
  }),
  invitedBy: one(users, {
    fields: [invitations.invitedById],
    references: [users.id],
    relationName: "invitation_sender",
  }),
}));

// Connection relations
export const connectionsRelations = relations(connections, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [connections.workspaceId],
    references: [workspaces.id],
  }),
  createdBy: one(users, {
    fields: [connections.createdById],
    references: [users.id],
    relationName: "connection_creator",
  }),
  schemas: many(schemas),
  queries: many(queries),
}));

// Schema relations
export const schemasRelations = relations(schemas, ({ one, many }) => ({
  connection: one(connections, {
    fields: [schemas.connectionId],
    references: [connections.id],
  }),
  tables: many(tables),
}));

// Table relations
export const tablesRelations = relations(tables, ({ one, many }) => ({
  schema: one(schemas, {
    fields: [tables.schemaId],
    references: [schemas.id],
  }),
  columns: many(columns),
}));

// Column relations
export const columnsRelations = relations(columns, ({ one }) => ({
  table: one(tables, {
    fields: [columns.tableId],
    references: [tables.id],
  }),
}));

// Query relations
export const queriesRelations = relations(queries, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [queries.workspaceId],
    references: [workspaces.id],
  }),
  connection: one(connections, {
    fields: [queries.connectionId],
    references: [connections.id],
  }),
  createdBy: one(users, {
    fields: [queries.createdById],
    references: [users.id],
    relationName: "query_creator",
  }),
  executions: many(queryExecutions),
}));

// Query execution relations
export const queryExecutionsRelations = relations(queryExecutions, ({ one }) => ({
  query: one(queries, {
    fields: [queryExecutions.queryId],
    references: [queries.id],
  }),
  executedBy: one(users, {
    fields: [queryExecutions.executedById],
    references: [users.id],
    relationName: "query_executor",
  }),
}));

// Documentation relations
export const docsRelations = relations(docs, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [docs.workspaceId],
    references: [workspaces.id],
  }),
  generatedBy: one(users, {
    fields: [docs.generatedById],
    references: [users.id],
    relationName: "doc_generator",
  }),
  lastEditedBy: one(users, {
    fields: [docs.lastEditedById],
    references: [users.id],
    relationName: "doc_editor",
  }),
}));

// Embedding relations
export const embeddingsRelations = relations(embeddings, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [embeddings.workspaceId],
    references: [workspaces.id],
  }),
}));

// User API key relations
export const userApiKeysRelations = relations(userApiKeys, ({ one }) => ({
  user: one(users, {
    fields: [userApiKeys.userId],
    references: [users.id],
  }),
}));

// Audit log relations
export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [auditLogs.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));