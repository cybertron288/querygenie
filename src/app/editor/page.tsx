"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Play,
  Save,
  Clock,
  Database,
  FileDown,
  Maximize2,
  Minimize2,
  History,
  AlertCircle,
  CheckCircle,
  Loader2,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import CodeMirror from '@uiw/react-codemirror';
import { sql as sqlLang } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Connection {
  id: string;
  name: string;
  type: string;
  database: string;
  isActive: boolean;
}

function QueryEditorContent() {
  const router = useRouter();
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Get query from URL params (from AI assistant)
  const searchParams = useSearchParams();
  const initialSql = searchParams.get("sql");
  const initialConnectionId = searchParams.get("connectionId");

  // State
  const [sql, setSql] = useState(
    initialSql || `-- Welcome to QueryGenie Editor!\n-- Start typing your SQL query here...\n\nSELECT * FROM users LIMIT 10;`
  );
  const [queryTitle, setQueryTitle] = useState("");
  const [selectedConnection, setSelectedConnection] = useState(initialConnectionId || "");
  const [isExecuting, setIsExecuting] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("results");

  // State for connections
  const [connections, setConnections] = useState<Connection[]>([]);
  const [isLoadingConnections, setIsLoadingConnections] = useState(true);

  // Get workspace ID from session - using the first workspace from memberships
  // Use the Acme Corp workspace ID which has the connections
  const workspaceId = (session as any)?.workspaces?.[0]?.id || "ddd3f516-4520-4987-b14e-768b9092d2f8";

  // Load connections
  useEffect(() => {
    const loadConnections = async () => {
      if (!session) return;
      
      try {
        setIsLoadingConnections(true);
        const response = await fetch(`/api/connections?workspaceId=${workspaceId}`);
        
        if (response.ok) {
          const data = await response.json();
          const formattedConnections = data.connections.map((conn: any) => ({
            id: conn.id,
            name: conn.name,
            type: conn.type,
            database: conn.database,
            isActive: conn.isActive,
          }));
          setConnections(formattedConnections);
          
          // Set first active connection as default
          const activeConnection = formattedConnections.find((c: Connection) => c.isActive);
          if (activeConnection && !selectedConnection) {
            setSelectedConnection(activeConnection.id);
          }
        }
      } catch (error) {
        console.error("Failed to load connections:", error);
      } finally {
        setIsLoadingConnections(false);
      }
    };

    loadConnections();
  }, [session, workspaceId]);

  // Auto-execute if query was passed from AI
  useEffect(() => {
    if (initialSql && initialConnectionId) {
      // Show a notification that query was loaded from AI
      setActiveTab("query");
    }
  }, [initialSql, initialConnectionId]);


  const handleExecute = async () => {
    if (!selectedConnection || !sql.trim()) return;

    setIsExecuting(true);
    setError(null);
    setResults(null);
    setExecutionTime(null);

    try {
      const response = await fetch("/api/queries/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: selectedConnection,
          sql: sql.trim(),
          saveQuery: false, // Don't auto-save unless user explicitly saves
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setResults({
          columns: data.columns || [],
          rows: data.rows || [],
          rowCount: data.rowCount || (data.rows || []).length,
        });
        setExecutionTime(data.executionTime);
        setActiveTab("results");
      } else {
        setError(data.message || data.error || "Query execution failed");
        setActiveTab("messages");
      }
    } catch (err: any) {
      setError(err.message || "Network error occurred");
      setActiveTab("messages");
    } finally {
      setIsExecuting(false);
    }
  };

  const handleSave = async () => {
    if (!queryTitle) {
      const title = prompt("Enter a title for this query:");
      if (!title) return;
      setQueryTitle(title);
    }

    // Save query logic here
    console.log("Saving query:", { title: queryTitle, sql });
  };

  const handleExport = (format: 'csv' | 'json' | 'excel' = 'csv') => {
    if (!results) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `query-results-${timestamp}`;

    switch (format) {
      case 'csv':
        exportCSV(filename);
        break;
      case 'json':
        exportJSON(filename);
        break;
      case 'excel':
        exportExcel(filename);
        break;
    }
  };

  const exportCSV = (filename: string) => {
    if (!results) return;

    // Properly escape CSV values
    const escapeCsvValue = (value: any) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Handle both array of objects and array of arrays
    const rows = results.rows.map((row: any) => {
      if (Array.isArray(row)) {
        // Row is already an array
        return row.map(escapeCsvValue);
      } else {
        // Row is an object, extract values by column order
        return results.columns.map((col: any) => escapeCsvValue(row[col]));
      }
    });

    const csv = [
      results.columns.map(escapeCsvValue).join(','),
      ...rows.map((row: any) => row.join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `${filename}.csv`);
  };

  const exportJSON = (filename: string) => {
    if (!results) return;

    // Convert to objects for consistent JSON structure
    const rowObjects = results.rows.map((row: any) => {
      if (Array.isArray(row)) {
        // Convert array to object using column names
        const obj: any = {};
        results.columns.forEach((col: any, idx: number) => {
          obj[col] = row[idx];
        });
        return obj;
      } else {
        // Row is already an object
        return row;
      }
    });

    const jsonData = {
      columns: results.columns,
      rows: rowObjects,
      rowCount: results.rows.length,
      exportedAt: new Date().toISOString(),
    };

    const json = JSON.stringify(jsonData, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    downloadBlob(blob, `${filename}.json`);
  };

  const exportExcel = (filename: string) => {
    if (!results) return;

    // Handle both array of objects and array of arrays
    const rows = results.rows.map((row: any) => {
      if (Array.isArray(row)) {
        // Row is already an array
        return row.map((value: any) => {
          if (value === null || value === undefined) return '';
          return String(value).replace(/\t/g, ' ');
        });
      } else {
        // Row is an object, extract values by column order
        return results.columns.map((col: any) => {
          const value = row[col];
          if (value === null || value === undefined) return '';
          return String(value).replace(/\t/g, ' ');
        });
      }
    });

    // Create a simple TSV format that Excel can open
    const tsv = [
      results.columns.join('\t'),
      ...rows.map((row: any) => row.join('\t'))
    ].join('\n');

    const blob = new Blob([tsv], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    downloadBlob(blob, `${filename}.xls`);
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatExecutionTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className={cn("flex h-screen overflow-hidden", isFullscreen && "fixed inset-0 z-50")}>
      {!isFullscreen && (
        <Sidebar 
          isOpen={sidebarOpen} 
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        />
      )}
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {!isFullscreen && (
          <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        )}
        
        <main className="flex-1 overflow-hidden">
          <div className="h-full flex flex-col">
            {/* Editor Header */}
            <div className="border-b bg-background/95 backdrop-blur p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                  <Database className="h-5 w-5 text-muted-foreground" />
                  <Input
                    placeholder="Untitled Query"
                    value={queryTitle}
                    onChange={(e) => setQueryTitle(e.target.value)}
                    className="max-w-xs"
                  />
                  
                  <Select 
                    value={selectedConnection} 
                    onValueChange={setSelectedConnection}
                    disabled={isLoadingConnections}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder={isLoadingConnections ? "Loading..." : "Select connection"} />
                    </SelectTrigger>
                    <SelectContent>
                      {connections.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground">
                          No connections available
                        </div>
                      ) : (
                        connections.map((conn) => (
                          <SelectItem key={conn.id} value={conn.id}>
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                "h-2 w-2 rounded-full",
                                conn.isActive ? "bg-green-500" : "bg-gray-400"
                              )} />
                              {conn.name}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  {initialSql && (
                    <Badge variant="outline" className="gap-1">
                      <Sparkles className="h-3 w-3" />
                      AI Generated
                    </Badge>
                  )}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push("/ai")}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    AI Assistant
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsFullscreen(!isFullscreen)}
                  >
                    {isFullscreen ? (
                      <Minimize2 className="h-4 w-4" />
                    ) : (
                      <Maximize2 className="h-4 w-4" />
                    )}
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSave}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                  
                  <Button
                    onClick={handleExecute}
                    disabled={isExecuting || !selectedConnection}
                  >
                    {isExecuting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Executing...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Execute
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
              {/* Editor Panel */}
              <div className="flex-1 flex flex-col border-r">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                  <TabsList className="w-full justify-start rounded-none border-b h-10">
                    <TabsTrigger value="query">Query</TabsTrigger>
                    <TabsTrigger value="results">
                      Results
                      {results && (
                        <Badge variant="secondary" className="ml-2">
                          {results.rowCount}
                        </Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="messages">Messages</TabsTrigger>
                  </TabsList>

                  <TabsContent value="query" className="flex-1 mt-0 p-0">
                    <CodeMirror
                      value={sql}
                      onChange={(value) => setSql(value)}
                      extensions={[sqlLang()]}
                      theme={oneDark}
                      height="100%"
                      basicSetup={{
                        lineNumbers: true,
                        highlightActiveLine: true,
                        highlightSelectionMatches: true,
                        bracketMatching: true,
                        closeBrackets: true,
                        autocompletion: true,
                        foldGutter: true,
                        searchKeymap: true,
                      }}
                    />
                  </TabsContent>

                  <TabsContent value="results" className="flex-1 mt-0 p-4">
                    {error && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Query Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}

                    {results && !error && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <Badge variant="outline">
                              {results.rowCount} row{results.rowCount !== 1 ? 's' : ''}
                            </Badge>
                            {executionTime && (
                              <Badge variant="outline">
                                <Clock className="h-3 w-3 mr-1" />
                                {formatExecutionTime(executionTime)}
                              </Badge>
                            )}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm">
                                <FileDown className="h-4 w-4 mr-2" />
                                Export
                                <ChevronDown className="h-4 w-4 ml-2" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleExport('csv')}>
                                Export as CSV
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleExport('json')}>
                                Export as JSON
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleExport('excel')}>
                                Export as Excel
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <ScrollArea className="h-[calc(100vh-280px)]">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                {results.columns.map((col: string) => (
                                  <TableHead key={col}>{col}</TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {results.rows.map((row: any, idx: number) => (
                                <TableRow key={idx}>
                                  {Array.isArray(row) ? 
                                    row.map((cell: any, cellIdx: number) => (
                                      <TableCell key={cellIdx} className="font-mono text-sm">
                                        {cell === null ? 'NULL' : String(cell)}
                                      </TableCell>
                                    )) :
                                    results.columns.map((col: string, cellIdx: number) => (
                                      <TableCell key={cellIdx} className="font-mono text-sm">
                                        {row[col] === null ? 'NULL' : String(row[col] ?? '')}
                                      </TableCell>
                                    ))
                                  }
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      </div>
                    )}

                    {!results && !error && !isExecuting && (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <Database className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No Results Yet</h3>
                        <p className="text-muted-foreground mb-4">
                          Execute a query to see results here
                        </p>
                        <Button onClick={handleExecute} disabled={!selectedConnection}>
                          <Play className="h-4 w-4 mr-2" />
                          Execute Query
                        </Button>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="messages" className="flex-1 mt-0 p-4">
                    <div className="space-y-2">
                      {executionTime && (
                        <Alert>
                          <CheckCircle className="h-4 w-4" />
                          <AlertTitle>Query Executed Successfully</AlertTitle>
                          <AlertDescription>
                            Query completed in {formatExecutionTime(executionTime)}
                          </AlertDescription>
                        </Alert>
                      )}
                      {error && (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Execution Error</AlertTitle>
                          <AlertDescription>{error}</AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Sidebar (Query History) */}
              {!isFullscreen && (
                <div className="w-80 bg-muted/30 p-4 overflow-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <History className="h-4 w-4" />
                      Query History
                    </h3>
                    <Button variant="ghost" size="sm">
                      View All
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    {[
                      { title: "User Analytics Query", time: "2 minutes ago", status: "success" },
                      { title: "Sales Report", time: "1 hour ago", status: "success" },
                      { title: "Product Inventory Check", time: "3 hours ago", status: "error" },
                      { title: "Customer Segmentation", time: "Yesterday", status: "success" },
                    ].map((query, idx) => (
                      <Card key={idx} className="cursor-pointer hover:bg-accent">
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{query.title}</p>
                              <p className="text-xs text-muted-foreground">{query.time}</p>
                            </div>
                            <Badge
                              variant={query.status === "success" ? "default" : "destructive"}
                              className="text-xs"
                            >
                              {query.status}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function QueryEditorPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    }>
      <QueryEditorContent />
    </Suspense>
  );
}