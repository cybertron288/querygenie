"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { 
  Database, 
  Plus,
  Settings,
  CheckCircle,
  XCircle,
  AlertTriangle,
  MoreHorizontal,
  Edit,
  Trash2,
  TestTube,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatRelativeDate } from "@/lib/utils";

export default function ConnectionsPage() {
  const { workspaceId } = useParams();
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Mock data - will replace with real API calls
  const connections = [
    {
      id: "1",
      name: "Production Database",
      type: "postgres",
      host: "prod-db.company.com",
      database: "app_production",
      status: "connected",
      lastTested: new Date(Date.now() - 1000 * 60 * 15),
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
    },
    {
      id: "2",
      name: "Analytics Warehouse", 
      type: "postgres",
      host: "analytics.company.com",
      database: "data_warehouse",
      status: "connected",
      lastTested: new Date(Date.now() - 1000 * 60 * 30),
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14),
    },
    {
      id: "3",
      name: "Development DB",
      type: "mysql",
      host: "dev-mysql.company.com", 
      database: "app_development",
      status: "error",
      lastTested: new Date(Date.now() - 1000 * 60 * 60 * 2),
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
    },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "connected":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Database className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      connected: "default",
      error: "destructive", 
      warning: "secondary",
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || "secondary"}>
        {status}
      </Badge>
    );
  };

  const connectionColumns = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }: any) => (
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="font-medium">{row.getValue("name")}</div>
            <div className="text-sm text-muted-foreground">
              {row.original.type} • {row.original.database}
            </div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "host", 
      header: "Host",
      cell: ({ row }: any) => (
        <div className="font-mono text-sm">{row.getValue("host")}</div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }: any) => {
        const status = row.getValue("status");
        return (
          <div className="flex items-center gap-2">
            {getStatusIcon(status)}
            {getStatusBadge(status)}
          </div>
        );
      },
    },
    {
      accessorKey: "lastTested",
      header: "Last Tested",
      cell: ({ row }: any) => formatRelativeDate(row.getValue("lastTested")),
    },
    {
      id: "actions",
      cell: ({ row }: any) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <TestTube className="mr-2 h-4 w-4" />
              Test Connection
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
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
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  Database Connections
                </h1>
                <p className="text-muted-foreground mt-2">
                  Manage your database connections for this workspace
                </p>
              </div>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Connection
              </Button>
            </div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Connections
                  </CardTitle>
                  <Database className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{connections.length}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Active Connections
                  </CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {connections.filter(c => c.status === "connected").length}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Failed Connections
                  </CardTitle>
                  <XCircle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {connections.filter(c => c.status === "error").length}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Connections Table */}
            <Card>
              <CardHeader>
                <CardTitle>Connections</CardTitle>
                <CardDescription>
                  All database connections in this workspace
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={connectionColumns}
                  data={connections}
                />
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}