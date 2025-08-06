"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

interface WorkspaceData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatar: string | null;
  ownerId: string;
  isActive: boolean;
  settings: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  currentUserRole: "owner" | "admin" | "editor" | "viewer" | null;
}

interface WorkspaceStats {
  connections: {
    total: number;
    active: number;
  };
  members: {
    total: number;
    active: number;
  };
  queries: {
    total: number;
    saved: number;
    shared: number;
  };
  recentQueries: Array<{
    id: string;
    title: string;
    connection: string;
    status: string;
    executionTime: number | null;
    rowsAffected: number | null;
    executedAt: Date;
  }>;
  trends: {
    daily: Array<{
      date: string;
      count: number;
      successCount: number;
      errorCount: number;
    }>;
    totalThisMonth: number;
    successRate: number;
  };
}

async function fetchWorkspace(workspaceId: string): Promise<WorkspaceData> {
  const response = await fetch(`/api/workspaces/${workspaceId}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch workspace: ${response.status}`);
  }
  
  return response.json();
}

async function fetchWorkspaceStats(workspaceId: string): Promise<WorkspaceStats> {
  const response = await fetch(`/api/workspaces/${workspaceId}/stats`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch workspace stats: ${response.status}`);
  }
  
  const result = await response.json();
  return result.data;
}

export function useWorkspace(workspaceId: string) {
  const { data: session } = useSession();
  
  return useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => fetchWorkspace(workspaceId),
    enabled: !!session?.user && !!workspaceId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useWorkspaceStats(workspaceId: string) {
  const { data: session } = useSession();
  
  return useQuery({
    queryKey: ["workspace-stats", workspaceId],
    queryFn: () => fetchWorkspaceStats(workspaceId),
    enabled: !!session?.user && !!workspaceId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}

export function useWorkspaces() {
  const { data: session } = useSession();
  
  return useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => {
      const response = await fetch("/api/workspaces");
      
      if (!response.ok) {
        throw new Error(`Failed to fetch workspaces: ${response.status}`);
      }
      
      const result = await response.json();
      return result.data || [];
    },
    enabled: !!session?.user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch database connections for a workspace
 */
export function useWorkspaceConnections(workspaceId: string) {
  const { data: session } = useSession();
  
  const fetchConnections = async () => {
    const response = await fetch(`/api/workspaces/${workspaceId}/connections`);
    
    if (!response.ok) {
      throw new Error("Failed to fetch connections");
    }
    
    const result = await response.json();
    return result.data || [];
  };

  return useQuery({
    queryKey: ["workspace-connections", workspaceId],
    queryFn: fetchConnections,
    enabled: !!session?.user && !!workspaceId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}