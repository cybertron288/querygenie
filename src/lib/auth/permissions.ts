/**
 * Permission System Utilities
 * 
 * Centralized permission checking for RBAC
 * Used throughout the application for consistent authorization
 */

import { db } from "@/lib/db";
import { memberships, workspaces } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { cache } from "react";

/**
 * Permission types for different actions
 */
export const PERMISSIONS = {
  // Workspace permissions
  workspace: {
    view: ["owner", "admin", "editor", "viewer"],
    edit: ["owner", "admin"],
    delete: ["owner"],
    invite: ["owner", "admin"],
    removeMembers: ["owner", "admin"],
    changeMemberRoles: ["owner", "admin"],
  },

  // Connection permissions
  connections: {
    view: ["owner", "admin", "editor", "viewer"],
    create: ["owner", "admin"],
    edit: ["owner", "admin"],
    delete: ["owner", "admin"],
    test: ["owner", "admin", "editor"],
    ingestSchema: ["owner", "admin"],
  },

  // Query permissions
  queries: {
    view: ["owner", "admin", "editor", "viewer"],
    execute: ["owner", "admin", "editor"],
    save: ["owner", "admin", "editor"],
    delete: ["owner", "admin", "editor"],
    share: ["owner", "admin", "editor"],
    export: ["owner", "admin", "editor", "viewer"],
  },

  // Documentation permissions
  docs: {
    view: ["owner", "admin", "editor", "viewer"],
    create: ["owner", "admin", "editor"],
    edit: ["owner", "admin", "editor"],
    delete: ["owner", "admin", "editor"],
    publish: ["owner", "admin"],
  },

  // Settings permissions
  settings: {
    view: ["owner", "admin"],
    edit: ["owner", "admin"],
    billing: ["owner"],
    apiKeys: ["owner", "admin"],
  },
} as const;

/**
 * User workspace role type
 */
export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer";

/**
 * Permission check result
 */
export interface PermissionCheckResult {
  hasPermission: boolean;
  role?: WorkspaceRole;
  workspace?: {
    id: string;
    name: string;
    slug: string;
  };
}

/**
 * Check if user has permission for an action in a workspace
 * Cached using React cache for performance
 */
export const checkPermission = cache(async (
  userId: string,
  workspaceId: string,
  resource: keyof typeof PERMISSIONS,
  action: string
): Promise<PermissionCheckResult> => {
  try {
    // Get user's membership in workspace
    const membership = await db.query.memberships.findFirst({
      where: and(
        eq(memberships.userId, userId),
        eq(memberships.workspaceId, workspaceId),
        eq(memberships.isActive, true)
      ),
      with: {
        workspace: true,
      },
    });

    if (!membership || !membership.workspace.isActive) {
      return { hasPermission: false };
    }

    // Check if user's role has required permission
    const requiredRoles = PERMISSIONS[resource]?.[action];
    if (!requiredRoles) {
      return { hasPermission: false };
    }

    const hasPermission = requiredRoles.includes(membership.role);

    return {
      hasPermission,
      role: membership.role,
      workspace: {
        id: membership.workspace.id,
        name: membership.workspace.name,
        slug: membership.workspace.slug,
      },
    };
  } catch (error) {
    console.error("Permission check failed:", error);
    return { hasPermission: false };
  }
});

/**
 * Check if user is workspace owner
 */
export const isWorkspaceOwner = cache(async (
  userId: string,
  workspaceId: string
): Promise<boolean> => {
  const result = await checkPermission(userId, workspaceId, "workspace", "delete");
  return result.hasPermission && result.role === "owner";
});

/**
 * Check if user is workspace admin or owner
 */
export const isWorkspaceAdmin = cache(async (
  userId: string,
  workspaceId: string
): Promise<boolean> => {
  const result = await checkPermission(userId, workspaceId, "workspace", "edit");
  return result.hasPermission && (result.role === "owner" || result.role === "admin");
});

/**
 * Check if user can edit content (editor, admin, or owner)
 */
export const canEditContent = cache(async (
  userId: string,
  workspaceId: string
): Promise<boolean> => {
  const result = await checkPermission(userId, workspaceId, "queries", "execute");
  return result.hasPermission;
});

/**
 * Check if user can view content (any role)
 */
export const canViewContent = cache(async (
  userId: string,
  workspaceId: string
): Promise<boolean> => {
  const result = await checkPermission(userId, workspaceId, "queries", "view");
  return result.hasPermission;
});

/**
 * Get user's role in workspace
 */
export const getUserWorkspaceRole = cache(async (
  userId: string,
  workspaceId: string
): Promise<WorkspaceRole | null> => {
  const membership = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.userId, userId),
      eq(memberships.workspaceId, workspaceId),
      eq(memberships.isActive, true)
    ),
  });

  return membership?.role ?? null;
});

/**
 * Get all workspaces user has access to
 */
export const getUserWorkspaces = cache(async (
  userId: string
): Promise<Array<{
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
  isOwner: boolean;
}>> => {
  const userMemberships = await db.query.memberships.findMany({
    where: and(
      eq(memberships.userId, userId),
      eq(memberships.isActive, true)
    ),
    with: {
      workspace: true,
    },
  });

  return userMemberships
    .filter((m) => m.workspace.isActive)
    .map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      role: m.role,
      isOwner: m.workspace.ownerId === userId,
    }));
});

/**
 * Batch permission check for multiple actions
 */
export const checkMultiplePermissions = cache(async (
  userId: string,
  workspaceId: string,
  checks: Array<{ resource: keyof typeof PERMISSIONS; action: string }>
): Promise<Record<string, boolean>> => {
  const results: Record<string, boolean> = {};

  // Get membership once
  const membership = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.userId, userId),
      eq(memberships.workspaceId, workspaceId),
      eq(memberships.isActive, true)
    ),
    with: {
      workspace: true,
    },
  });

  if (!membership || !membership.workspace.isActive) {
    // Return false for all checks
    checks.forEach((check) => {
      results[`${check.resource}.${check.action}`] = false;
    });
    return results;
  }

  // Check each permission
  checks.forEach((check) => {
    const requiredRoles = PERMISSIONS[check.resource]?.[check.action];
    results[`${check.resource}.${check.action}`] = requiredRoles
      ? requiredRoles.includes(membership.role)
      : false;
  });

  return results;
});

/**
 * Hook for permission checking in React components
 * Usage: const { canEdit, canDelete } = usePermissions(workspaceId)
 */
export function createPermissionChecker(userId: string, workspaceId: string) {
  return {
    // Workspace permissions
    canViewWorkspace: () => checkPermission(userId, workspaceId, "workspace", "view"),
    canEditWorkspace: () => checkPermission(userId, workspaceId, "workspace", "edit"),
    canDeleteWorkspace: () => checkPermission(userId, workspaceId, "workspace", "delete"),
    canInviteMembers: () => checkPermission(userId, workspaceId, "workspace", "invite"),
    
    // Connection permissions
    canViewConnections: () => checkPermission(userId, workspaceId, "connections", "view"),
    canCreateConnections: () => checkPermission(userId, workspaceId, "connections", "create"),
    canEditConnections: () => checkPermission(userId, workspaceId, "connections", "edit"),
    canDeleteConnections: () => checkPermission(userId, workspaceId, "connections", "delete"),
    
    // Query permissions
    canViewQueries: () => checkPermission(userId, workspaceId, "queries", "view"),
    canExecuteQueries: () => checkPermission(userId, workspaceId, "queries", "execute"),
    canSaveQueries: () => checkPermission(userId, workspaceId, "queries", "save"),
    canDeleteQueries: () => checkPermission(userId, workspaceId, "queries", "delete"),
    
    // Documentation permissions
    canViewDocs: () => checkPermission(userId, workspaceId, "docs", "view"),
    canCreateDocs: () => checkPermission(userId, workspaceId, "docs", "create"),
    canEditDocs: () => checkPermission(userId, workspaceId, "docs", "edit"),
    canDeleteDocs: () => checkPermission(userId, workspaceId, "docs", "delete"),
    
    // Settings permissions
    canViewSettings: () => checkPermission(userId, workspaceId, "settings", "view"),
    canEditSettings: () => checkPermission(userId, workspaceId, "settings", "edit"),
    canManageBilling: () => checkPermission(userId, workspaceId, "settings", "billing"),
  };
}

/**
 * Format role for display
 */
export function formatRole(role: WorkspaceRole): string {
  const roleLabels = {
    owner: "Owner",
    admin: "Administrator",
    editor: "Editor",
    viewer: "Viewer",
  };
  return roleLabels[role] || role;
}

/**
 * Get role badge color
 */
export function getRoleBadgeColor(role: WorkspaceRole): string {
  const roleColors = {
    owner: "bg-purple-100 text-purple-800",
    admin: "bg-blue-100 text-blue-800",
    editor: "bg-green-100 text-green-800",
    viewer: "bg-gray-100 text-gray-800",
  };
  return roleColors[role] || "bg-gray-100 text-gray-800";
}