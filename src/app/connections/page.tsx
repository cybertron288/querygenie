"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Database,
  Plus,
  Settings,
  Trash2,
  Edit2,
  TestTube,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Shield,
  Clock,
  Copy,
  ExternalLink,
  RefreshCw,
  Zap,
  Server,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Connection {
  id: string;
  name: string;
  type: "postgres" | "mysql" | "sqlite";
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  isActive: boolean;
  lastConnectedAt?: string;
  createdAt: string;
  updatedAt: string;
}

const connectionTypes = {
  postgres: {
    name: "PostgreSQL",
    icon: Database,
    color: "text-blue-500",
    defaultPort: 5432,
    description: "Open source relational database",
  },
  mysql: {
    name: "MySQL",
    icon: Database,
    color: "text-orange-500",
    defaultPort: 3306,
    description: "Popular open source database",
  },
  sqlite: {
    name: "SQLite",
    icon: Database,
    color: "text-green-500",
    defaultPort: null,
    description: "Embedded database",
  },
};

export default function ConnectionsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form state
  const [connectionForm, setConnectionForm] = useState({
    name: "",
    type: "postgres" as keyof typeof connectionTypes,
    host: "",
    port: 5432,
    database: "",
    username: "",
    password: "",
    connectionString: "",
    ssl: false,
    useConnectionString: false,
  });

  // Get workspace ID from session - using the first workspace from memberships
  // Use the Acme Corp workspace ID which has the connections
  const workspaceId = session?.workspaces?.[0]?.id || session?.user?.memberships?.[0]?.workspaceId || "ddd3f516-4520-4987-b14e-768b9092d2f8";

  // Load connections
  useEffect(() => {
    if (session) {
      loadConnections();
    }
  }, [session]);

  const loadConnections = async () => {
    try {
      setIsLoading(true);
      console.log("Loading connections for workspace:", workspaceId);
      console.log("Session data:", session);
      const response = await fetch(`/api/connections?workspaceId=${workspaceId}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log("Connections API response:", data);
        console.log("Number of connections:", data.connections?.length || 0);
        setConnections(data.connections || []);
      } else {
        const errorData = await response.json();
        console.error("Failed to load connections:", errorData);
        throw new Error(errorData.message || "Failed to load connections");
      }
    } catch (error) {
      console.error("Error loading connections:", error);
      setMessage({ type: "error", text: "Failed to load connections" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const payload = connectionForm.useConnectionString
        ? {
            type: connectionForm.type,
            connectionString: connectionForm.connectionString,
            ssl: connectionForm.ssl,
          }
        : {
            type: connectionForm.type,
            host: connectionForm.host,
            port: connectionForm.port,
            database: connectionForm.database,
            username: connectionForm.username,
            password: connectionForm.password,
            ssl: connectionForm.ssl,
          };

      const response = await fetch("/api/connections/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      setTestResult(result);
      
      if (result.success) {
        setMessage({ type: "success", text: "Connection test successful!" });
      } else {
        setMessage({ type: "error", text: result.message || "Connection test failed" });
      }
    } catch (error) {
      setTestResult({ success: false, message: "Test failed" });
      setMessage({ type: "error", text: "Connection test failed" });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveConnection = async () => {
    try {
      const payload = {
        workspaceId,
        name: connectionForm.name,
        type: connectionForm.type,
        ...(connectionForm.useConnectionString
          ? {
              connectionString: connectionForm.connectionString,
            }
          : {
              host: connectionForm.host,
              port: connectionForm.port,
              database: connectionForm.database,
              username: connectionForm.username,
              password: connectionForm.password,
            }),
        ssl: connectionForm.ssl,
      };

      const url = selectedConnection
        ? `/api/connections/${selectedConnection.id}`
        : "/api/connections";
      
      const method = selectedConnection ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setMessage({
          type: "success",
          text: selectedConnection ? "Connection updated" : "Connection created",
        });
        setIsAddDialogOpen(false);
        setIsEditDialogOpen(false);
        loadConnections();
        resetForm();
      } else {
        throw new Error("Failed to save connection");
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to save connection" });
    }
  };

  const handleDeleteConnection = async (connectionId: string) => {
    if (!confirm("Are you sure you want to delete this connection?")) return;

    try {
      const response = await fetch(`/api/connections/${connectionId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setMessage({ type: "success", text: "Connection deleted" });
        loadConnections();
      } else {
        throw new Error("Failed to delete connection");
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to delete connection" });
    }
  };

  const handleEditConnection = (connection: Connection) => {
    setSelectedConnection(connection);
    setConnectionForm({
      name: connection.name,
      type: connection.type,
      host: connection.host || "",
      port: connection.port || connectionTypes[connection.type].defaultPort || 5432,
      database: connection.database || "",
      username: connection.username || "",
      password: "",
      connectionString: "",
      ssl: false,
      useConnectionString: false,
    });
    setIsEditDialogOpen(true);
  };

  const resetForm = () => {
    setConnectionForm({
      name: "",
      type: "postgres",
      host: "",
      port: 5432,
      database: "",
      username: "",
      password: "",
      connectionString: "",
      ssl: false,
      useConnectionString: false,
    });
    setSelectedConnection(null);
    setTestResult(null);
  };

  // Clear message after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar 
        isOpen={sidebarOpen} 
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Database Connections</h1>
                <p className="text-muted-foreground mt-1">
                  Manage your database connections securely
                </p>
              </div>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Connection
              </Button>
            </div>

            {/* Message Alert */}
            {message && (
              <Alert variant={message.type === "error" ? "destructive" : "default"}>
                {message.type === "error" ? (
                  <AlertCircle className="h-4 w-4" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                <AlertDescription>{message.text}</AlertDescription>
              </Alert>
            )}

            {/* Connections Grid */}
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : connections.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center h-64">
                  <Database className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No connections yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Add your first database connection to get started
                  </p>
                  <Button onClick={() => setIsAddDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Connection
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {connections.map((connection) => {
                  const typeInfo = connectionTypes[connection.type];
                  const Icon = typeInfo.icon;
                  
                  return (
                    <Card key={connection.id} className="relative">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn("p-2 rounded-lg bg-secondary", typeInfo.color)}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <div>
                              <CardTitle className="text-base">{connection.name}</CardTitle>
                              <CardDescription>{typeInfo.name}</CardDescription>
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Settings className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditConnection(connection)}>
                                <Edit2 className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={async () => {
                                  const response = await fetch(`/api/connections/${connection.id}/test`, {
                                    method: "POST",
                                  });
                                  const result = await response.json();
                                  setMessage({
                                    type: result.success ? "success" : "error",
                                    text: result.message,
                                  });
                                }}
                              >
                                <TestTube className="h-4 w-4 mr-2" />
                                Test Connection
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleDeleteConnection(connection.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-sm">
                          {connection.host && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Server className="h-3 w-3" />
                              {connection.host}:{connection.port}
                            </div>
                          )}
                          {connection.database && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Database className="h-3 w-3" />
                              {connection.database}
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={connection.isActive ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {connection.isActive ? "Active" : "Inactive"}
                            </Badge>
                            {connection.lastConnectedAt && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Last used {new Date(connection.lastConnectedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Add/Edit Connection Dialog */}
      <Dialog
        open={isAddDialogOpen || isEditDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddDialogOpen(false);
            setIsEditDialogOpen(false);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedConnection ? "Edit Connection" : "Add New Connection"}
            </DialogTitle>
            <DialogDescription>
              Configure your database connection securely. Credentials are encrypted before storage.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Connection Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Connection Name</Label>
              <Input
                id="name"
                placeholder="e.g., Production Database"
                value={connectionForm.name}
                onChange={(e) => setConnectionForm({ ...connectionForm, name: e.target.value })}
              />
            </div>

            {/* Database Type */}
            <div className="space-y-2">
              <Label htmlFor="type">Database Type</Label>
              <Select
                value={connectionForm.type}
                onValueChange={(value) => {
                  const type = value as keyof typeof connectionTypes;
                  setConnectionForm({
                    ...connectionForm,
                    type,
                    port: connectionTypes[type].defaultPort || 5432,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(connectionTypes).map(([key, info]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <info.icon className={cn("h-4 w-4", info.color)} />
                        {info.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Connection Method */}
            <Tabs
              value={connectionForm.useConnectionString ? "string" : "fields"}
              onValueChange={(value) =>
                setConnectionForm({ ...connectionForm, useConnectionString: value === "string" })
              }
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="fields">Connection Fields</TabsTrigger>
                <TabsTrigger value="string">Connection String</TabsTrigger>
              </TabsList>

              <TabsContent value="fields" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="host">Host</Label>
                    <Input
                      id="host"
                      placeholder="localhost"
                      value={connectionForm.host}
                      onChange={(e) => setConnectionForm({ ...connectionForm, host: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="port">Port</Label>
                    <Input
                      id="port"
                      type="number"
                      placeholder={String(connectionForm.port)}
                      value={connectionForm.port}
                      onChange={(e) =>
                        setConnectionForm({ ...connectionForm, port: parseInt(e.target.value) })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="database">Database Name</Label>
                  <Input
                    id="database"
                    placeholder="mydb"
                    value={connectionForm.database}
                    onChange={(e) =>
                      setConnectionForm({ ...connectionForm, database: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      placeholder="dbuser"
                      value={connectionForm.username}
                      onChange={(e) =>
                        setConnectionForm({ ...connectionForm, username: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={connectionForm.password}
                      onChange={(e) =>
                        setConnectionForm({ ...connectionForm, password: e.target.value })
                      }
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="string" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="connectionString">Connection String</Label>
                  <Textarea
                    id="connectionString"
                    placeholder={`${connectionForm.type}://username:password@host:port/database`}
                    value={connectionForm.connectionString}
                    onChange={(e) =>
                      setConnectionForm({ ...connectionForm, connectionString: e.target.value })
                    }
                    className="font-mono text-sm"
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the complete connection string for your database
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            {/* SSL Option */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="ssl"
                checked={connectionForm.ssl}
                onCheckedChange={(checked) =>
                  setConnectionForm({ ...connectionForm, ssl: checked as boolean })
                }
              />
              <Label htmlFor="ssl" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Use SSL/TLS connection
              </Label>
            </div>

            {/* Test Result */}
            {testResult && (
              <Alert variant={testResult.success ? "default" : "destructive"}>
                {testResult.success ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <AlertTitle>{testResult.success ? "Success" : "Failed"}</AlertTitle>
                <AlertDescription>
                  {testResult.message}
                  {testResult.details?.version && (
                    <div className="mt-2 text-xs font-mono">{testResult.details.version}</div>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleTestConnection} disabled={isTesting}>
              {isTesting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <TestTube className="h-4 w-4 mr-2" />
                  Test Connection
                </>
              )}
            </Button>
            <Button
              onClick={handleSaveConnection}
              disabled={!connectionForm.name || (!testResult?.success && !selectedConnection)}
            >
              {selectedConnection ? "Update" : "Save"} Connection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}