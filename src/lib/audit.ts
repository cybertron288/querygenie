/**
 * Audit Logging Utilities
 * 
 * Tracks all important actions for compliance and debugging
 */

import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { nanoid } from "nanoid";

export type AuditAction = 
  | "auth.login"
  | "auth.logout"
  | "auth.signup"
  | "auth.password_reset"
  | "workspace.created"
  | "workspace.updated"
  | "workspace.deleted"
  | "member.invited"
  | "member.joined"
  | "member.removed"
  | "member.role_changed"
  | "connection.created"
  | "connection.updated"
  | "connection.deleted"
  | "connection.tested"
  | "query.executed"
  | "query.saved"
  | "query.shared"
  | "query.deleted"
  | "doc.created"
  | "doc.updated"
  | "doc.deleted"
  | "api_key.created"
  | "api_key.revoked"
  | "settings.updated";

export type AuditResource = 
  | "user"
  | "workspace"
  | "membership"
  | "invitation"
  | "connection"
  | "query"
  | "doc"
  | "api_key"
  | "settings";

interface AuditLogOptions {
  workspaceId?: string;
  userId: string;
  action: AuditAction;
  resource: AuditResource;
  resourceId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Create an audit log entry
 */
export async function auditLog(options: AuditLogOptions): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      id: nanoid(),
      workspaceId: options.workspaceId || null,
      userId: options.userId,
      action: options.action,
      resource: options.resource,
      resourceId: options.resourceId || null,
      metadata: options.metadata || {},
      ipAddress: options.ipAddress || null,
      userAgent: options.userAgent || null,
      createdAt: new Date(),
    });
  } catch (error) {
    // Log to console but don't throw - audit failures shouldn't break the app
    console.error("Failed to create audit log:", error);
  }
}

/**
 * Batch audit logging for multiple events
 */
export async function batchAuditLog(
  events: AuditLogOptions[]
): Promise<void> {
  if (events.length === 0) return;

  try {
    const logs = events.map(event => ({
      id: nanoid(),
      workspaceId: event.workspaceId || null,
      userId: event.userId,
      action: event.action,
      resource: event.resource,
      resourceId: event.resourceId || null,
      metadata: event.metadata || {},
      ipAddress: event.ipAddress || null,
      userAgent: event.userAgent || null,
      createdAt: new Date(),
    }));

    await db.insert(auditLogs).values(logs);
  } catch (error) {
    console.error("Failed to create batch audit logs:", error);
  }
}

/**
 * Get IP address from request
 */
export function getIpAddress(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }
  
  return "unknown";
}

/**
 * Get user agent from request
 */
export function getUserAgent(request: Request): string {
  return request.headers.get("user-agent") || "unknown";
}

/**
 * Create audit context from request
 */
export function createAuditContext(request: Request) {
  return {
    ipAddress: getIpAddress(request),
    userAgent: getUserAgent(request),
  };
}