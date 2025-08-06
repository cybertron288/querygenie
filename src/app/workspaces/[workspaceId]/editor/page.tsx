"use client";

import { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Play,
  Save,
  Share,
  Database,
  Clock,
  AlertCircle,
  CheckCircle,
  Loader2,
  Settings,
  History,
  Download,
  Copy,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable } from "@/components/ui/data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';
import { useTheme } from "next-themes";
import { formatRelativeDate, formatNumber } from "@/lib/utils";
import { useWorkspaceConnections } from "@/hooks/use-workspace";

export default function QueryEditorPage() {
  const { workspaceId } = useParams();
  const { data: session } = useSession();
  const { theme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Fetch workspace connections
  const { 
    data: connectionsData, 
    isLoading: connectionsLoading,
    error: connectionsError 
  } = useWorkspaceConnections(workspaceId as string);

  // Query editor state
  const [sqlQuery, setSqlQuery] = useState("-- Write your SQL query here\nSELECT * FROM users LIMIT 10;");
  const [queryTitle, setQueryTitle] = useState("");
  const [selectedConnection, setSelectedConnection] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [executionTime, setExecutionTime] = useState<number | null>(null);

  // Process connections data
  const connections = connectionsData?.map((conn: any) => ({
    id: conn.id,
    name: conn.name,
    type: conn.type,
    mode: conn.mode,
    status: conn.isActive ? "connected" : "inactive",
    lastTested: conn.lastTestedAt,
  })) || [];

  // Generate result columns dynamically based on data
  const resultColumns = results?.columns?.map((column: string) => ({
    accessorKey: column,
    header: column.charAt(0).toUpperCase() + column.slice(1).replace(/_/g, ' '),
  })) || [];

  const handleExecuteQuery = useCallback(async () => {
    if (!selectedConnection) {
      setError("Please select a database connection");
      return;
    }

    if (!sqlQuery.trim()) {
      setError("Please enter a SQL query");
      return;
    }

    setIsExecuting(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sql: sqlQuery,
          connectionId: selectedConnection,
          title: queryTitle || undefined,
          saveQuery: !!queryTitle,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Query execution failed");
      }

      if (data.success) {
        setResults({
          rows: data.data.rows || [],
          rowCount: data.data.rowCount || 0,
          columns: data.data.columns || [],
        });
        setExecutionTime(data.data.executionTime);
      } else {
        throw new Error(data.message || "Query execution failed");
      }
    } catch (err: any) {
      setError(err.message || "Query execution failed");
    } finally {
      setIsExecuting(false);
    }
  }, [selectedConnection, sqlQuery, queryTitle, workspaceId]);

  const handleSaveQuery = useCallback(async () => {
    if (!queryTitle.trim()) {
      setError("Please enter a query title before saving");
      return;
    }

    try {
      // Mock API call - replace with real save
      console.log("Saving query:", { title: queryTitle, sql: sqlQuery });
      
      // Show success message
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to save query");
    }
  }, [queryTitle, sqlQuery]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar 
        isOpen={sidebarOpen} 
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        workspaceId={workspaceId as string}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        
        <main className="flex-1 overflow-hidden">
          <div className="h-full flex flex-col">
            {/* Query Controls */}
            <div className="border-b bg-background/95 backdrop-blur p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="connection">Connection:</Label>
                    <Select 
                      value={selectedConnection} 
                      onValueChange={setSelectedConnection}
                      disabled={connectionsLoading}
                    >
                      <SelectTrigger id="connection" className="w-[250px]">
                        <SelectValue placeholder={
                          connectionsLoading 
                            ? "Loading connections..." 
                            : connections.length === 0 
                              ? "No connections available"
                              : "Select database"
                        } />
                      </SelectTrigger>
                      <SelectContent>
                        {connections.map((conn) => (
                          <SelectItem key={conn.id} value={conn.id}>
                            <div className="flex items-center gap-2">
                              <Database className="h-4 w-4" />
                              <div className="flex flex-col items-start">
                                <div className="flex items-center gap-2">
                                  {conn.name}
                                  <Badge 
                                    variant={conn.status === "connected" ? "default" : "destructive"}
                                    className="text-xs"
                                  >
                                    {conn.status}
                                  </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {conn.type} • {conn.mode}
                                </div>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {connectionsError && (
                      <Badge variant="destructive" className="text-xs">
                        Failed to load
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-1 max-w-md">
                    <Label htmlFor="title">Title:</Label>
                    <Input
                      id="title"
                      placeholder="Query title (optional for execution)"
                      value={queryTitle}
                      onChange={(e) => setQueryTitle(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <History className="h-4 w-4 mr-2" />
                    History
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleSaveQuery}
                    disabled={!queryTitle.trim()}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={handleExecuteQuery}
                    disabled={isExecuting || !selectedConnection}
                  >
                    {isExecuting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    Execute
                  </Button>
                </div>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden">
              <div className="h-full flex flex-col lg:flex-row">
                {/* SQL Editor */}
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="border-b p-2 bg-muted/50">
                    <span className="text-sm font-medium">SQL Query</span>
                  </div>
                  <div className="flex-1 overflow-auto">
                    <CodeMirror
                      value={sqlQuery}
                      onChange={(val) => setSqlQuery(val)}
                      extensions={[sql()]}
                      theme={theme === 'dark' ? oneDark : undefined}
                      basicSetup={{
                        lineNumbers: true,
                        highlightActiveLine: true,
                        highlightSelectionMatches: true,
                        searchKeymap: true,
                      }}
                      className="h-full"
                    />
                  </div>
                </div>

                {/* Results Panel */}
                <div className="lg:w-1/2 flex flex-col border-l bg-background min-h-0">
                  <div className="border-b p-2 bg-muted/50 flex items-center justify-between">
                    <span className="text-sm font-medium">Results</span>
                    {results && (
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {executionTime && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {executionTime}ms
                          </div>
                        )}
                        <div>{results.rowCount} rows</div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 overflow-auto p-4">
                    {error && (
                      <div className="flex items-start gap-2 p-4 border border-destructive/20 bg-destructive/5 rounded-lg">
                        <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                        <div>
                          <h4 className="font-medium text-destructive">Query Error</h4>
                          <p className="text-sm text-destructive/80 mt-1">{error}</p>
                        </div>
                      </div>
                    )}

                    {isExecuting && (
                      <div className="flex items-center justify-center h-32">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Executing query...
                        </div>
                      </div>
                    )}

                    {results && !error && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          Query executed successfully
                        </div>
                        
                        <Tabs defaultValue="table" className="w-full">
                          <TabsList>
                            <TabsTrigger value="table">Table</TabsTrigger>
                            <TabsTrigger value="json">JSON</TabsTrigger>
                          </TabsList>
                          
                          <TabsContent value="table" className="mt-4">
                            <DataTable
                              columns={resultColumns}
                              data={results.rows}
                            />
                          </TabsContent>
                          
                          <TabsContent value="json" className="mt-4">
                            <div className="relative">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="absolute top-2 right-2 z-10"
                                onClick={() => navigator.clipboard.writeText(JSON.stringify(results.rows, null, 2))}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm">
                                {JSON.stringify(results.rows, null, 2)}
                              </pre>
                            </div>
                          </TabsContent>
                        </Tabs>
                      </div>
                    )}

                    {!results && !error && !isExecuting && (
                      <div className="flex items-center justify-center h-32 text-muted-foreground">
                        <div className="text-center">
                          <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>Execute a query to see results</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}