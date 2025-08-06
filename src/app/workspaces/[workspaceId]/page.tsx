"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { 
  Database, 
  FileCode, 
  Clock, 
  TrendingUp,
  Plus,
  ArrowRight,
  Sparkles,
  Users,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { formatRelativeDate, formatNumber } from "@/lib/utils";
import { useWorkspace, useWorkspaceStats } from "@/hooks/use-workspace";
import Link from "next/link";

export default function WorkspacePage() {
  const { workspaceId } = useParams();
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Fetch real data from API
  const { 
    data: workspaceData, 
    isLoading: workspaceLoading,
    error: workspaceError 
  } = useWorkspace(workspaceId as string);
  
  const { 
    data: statsData, 
    isLoading: statsLoading,
    error: statsError 
  } = useWorkspaceStats(workspaceId as string);

  // Show loading state
  if (workspaceLoading || statsLoading) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar 
          isOpen={sidebarOpen} 
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          workspaceId={workspaceId as string}
        />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
          
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-7xl mx-auto flex items-center justify-center h-full">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
                Loading workspace...
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Show error state
  if (workspaceError || statsError || !workspaceData || !statsData) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar 
          isOpen={sidebarOpen} 
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          workspaceId={workspaceId as string}
        />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
          
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-7xl mx-auto flex items-center justify-center h-full">
              <div className="text-center">
                <h2 className="text-2xl font-semibold mb-2">Workspace not found</h2>
                <p className="text-muted-foreground">
                  This workspace may not exist or you don't have permission to access it.
                </p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const queryColumns = [
    {
      accessorKey: "title",
      header: "Query",
      cell: ({ row }: any) => (
        <div className="flex items-center gap-2">
          <FileCode className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{row.getValue("title")}</span>
        </div>
      ),
    },
    {
      accessorKey: "connection",
      header: "Connection",
      cell: ({ row }: any) => (
        <Badge variant="secondary">{row.getValue("connection")}</Badge>
      ),
    },
    {
      accessorKey: "executedAt", 
      header: "Executed",
      cell: ({ row }: any) => formatRelativeDate(row.getValue("executedAt")),
    },
    {
      accessorKey: "status",
      header: "Status", 
      cell: ({ row }: any) => {
        const status = row.getValue("status");
        const variant = status === "completed" ? "default" : 
                      status === "failed" ? "destructive" : 
                      "secondary";
        return (
          <Badge variant={variant}>
            {status}
          </Badge>
        );
      },
    },
    {
      accessorKey: "rowsAffected",
      header: "Rows",
      cell: ({ row }: any) => {
        const rows = row.getValue("rowsAffected");
        return rows ? formatNumber(rows) : "-";
      },
    },
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar 
        isOpen={sidebarOpen} 
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        workspaceId={workspaceId as string}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Workspace Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  {workspaceData.name}
                </h1>
                <p className="text-muted-foreground mt-2">
                  {workspaceData.description || "No description provided"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <Users className="h-4 w-4 mr-2" />
                  Manage Members
                </Button>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  New Query
                </Button>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Queries
                  </CardTitle>
                  <FileCode className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatNumber(statsData.queries.total)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {statsData.trends.totalThisMonth > 0 ? `${statsData.trends.totalThisMonth} this month` : "No recent activity"}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Active Connections
                  </CardTitle>
                  <Database className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {statsData.connections.active}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {statsData.connections.total} total connections
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Saved Queries
                  </CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {statsData.queries.saved}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {statsData.queries.shared} shared with team
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Team Members
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {statsData.members.active}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {statsData.members.total} total members
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="grid gap-4 md:grid-cols-3">
              <Link href={`/workspaces/${workspaceId}/query`}>
                <Card className="cursor-pointer hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Sparkles className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">AI Query Builder</CardTitle>
                          <CardDescription>Generate SQL with AI</CardDescription>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </CardHeader>
                </Card>
              </Link>

              <Link href={`/workspaces/${workspaceId}/connections`}>
                <Card className="cursor-pointer hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Database className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">Connections</CardTitle>
                          <CardDescription>Manage database connections</CardDescription>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </CardHeader>
                </Card>
              </Link>

              <Link href={`/workspaces/${workspaceId}/editor`}>
                <Card className="cursor-pointer hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <FileCode className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">Query Editor</CardTitle>
                          <CardDescription>Write SQL queries</CardDescription>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            </div>

            {/* Recent Queries */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Recent Queries</CardTitle>
                    <CardDescription>
                      Recently executed queries in this workspace
                    </CardDescription>
                  </div>
                  <Link href={`/workspaces/${workspaceId}/queries`}>
                    <Button variant="outline" size="sm">
                      View All
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={queryColumns}
                  data={statsData.recentQueries}
                  showColumnToggle={false}
                  showPagination={false}
                />
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}