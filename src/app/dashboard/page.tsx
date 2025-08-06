"use client";

import { useState } from "react";
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
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { formatRelativeDate, formatNumber } from "@/lib/utils";
import Link from "next/link";

export default function DashboardPage() {
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Mock data - replace with real API calls
  const stats = {
    totalQueries: 1234,
    activeConnections: 8,
    savedQueries: 156,
    teamMembers: 12,
  };

  const recentQueries = [
    {
      id: "1",
      title: "Get user analytics",
      database: "Production",
      executedAt: new Date(Date.now() - 1000 * 60 * 30),
      status: "success",
      rowCount: 245,
    },
    {
      id: "2",
      title: "Monthly revenue report",
      database: "Analytics",
      executedAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
      status: "success",
      rowCount: 1024,
    },
    {
      id: "3",
      title: "Customer segmentation",
      database: "Production",
      executedAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
      status: "error",
      rowCount: 0,
    },
  ];

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
      accessorKey: "database",
      header: "Database",
      cell: ({ row }: any) => (
        <Badge variant="secondary">{row.getValue("database")}</Badge>
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
        return (
          <Badge variant={status === "success" ? "default" : "destructive"}>
            {status}
          </Badge>
        );
      },
    },
    {
      accessorKey: "rowCount",
      header: "Rows",
      cell: ({ row }: any) => formatNumber(row.getValue("rowCount")),
    },
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar 
        isOpen={sidebarOpen} 
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Welcome Section */}
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Welcome back, {session?.user?.name || "User"}!
              </h1>
              <p className="text-muted-foreground mt-2">
                Here's an overview of your database activity
              </p>
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
                    {formatNumber(stats.totalQueries)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    +20% from last month
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
                    {stats.activeConnections}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Across 3 workspaces
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
                    {stats.savedQueries}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    12 shared with team
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
                    {stats.teamMembers}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    3 pending invites
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="grid gap-4 md:grid-cols-3">
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

              <Card className="cursor-pointer hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Database className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">New Connection</CardTitle>
                        <CardDescription>Add a database</CardDescription>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </CardHeader>
              </Card>

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
            </div>

            {/* Recent Queries */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Recent Queries</CardTitle>
                    <CardDescription>
                      Your recently executed queries
                    </CardDescription>
                  </div>
                  <Link href="/queries">
                    <Button variant="outline" size="sm">
                      View All
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={queryColumns}
                  data={recentQueries}
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