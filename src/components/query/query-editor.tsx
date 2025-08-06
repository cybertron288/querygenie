"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Save, Download, Share2, Sparkles, History, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import CodeMirror from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";
import { oneDark } from "@codemirror/theme-one-dark";
import { useTheme } from "next-themes";

interface QueryEditorProps {
  workspaceId: string;
  connectionId?: string;
  onExecute?: (query: string) => void;
  initialQuery?: string;
}

export function QueryEditor({
  workspaceId,
  connectionId,
  onExecute,
  initialQuery = "",
}: QueryEditorProps) {
  const { theme } = useTheme();
  const { toast } = useToast();
  const [query, setQuery] = useState(initialQuery);
  const [isExecuting, setIsExecuting] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState(connectionId);
  const [aiPrompt, setAiPrompt] = useState("");
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [queryTabs, setQueryTabs] = useState([
    { id: "1", title: "Query 1", query: initialQuery, active: true },
  ]);
  const [activeTab, setActiveTab] = useState("1");

  const handleExecute = async () => {
    if (!selectedConnection) {
      toast({
        title: "No connection selected",
        description: "Please select a database connection first",
        variant: "destructive",
      });
      return;
    }

    if (!query.trim()) {
      toast({
        title: "Empty query",
        description: "Please enter a SQL query to execute",
        variant: "destructive",
      });
      return;
    }

    setIsExecuting(true);
    try {
      // Call the execute function or API
      if (onExecute) {
        await onExecute(query);
      } else {
        // Default API call
        const response = await fetch(`/api/workspaces/${workspaceId}/queries`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            connectionId: selectedConnection,
            sqlQuery: query,
            action: "execute",
          }),
        });

        if (!response.ok) {
          throw new Error("Query execution failed");
        }

        const result = await response.json();
        toast({
          title: "Query executed successfully",
          description: `${result.data.rowCount} rows returned in ${result.data.executionTimeMs}ms`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Execution failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleSave = async () => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/queries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: selectedConnection,
          sqlQuery: query,
          title: `Query ${activeTab}`,
          isSaved: true,
          action: "execute",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save query");
      }

      toast({
        title: "Query saved",
        description: "Your query has been saved successfully",
      });
    } catch (error: any) {
      toast({
        title: "Save failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) {
      toast({
        title: "Empty prompt",
        description: "Please describe what query you want to generate",
        variant: "destructive",
      });
      return;
    }

    setIsExecuting(true);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/queries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: selectedConnection,
          prompt: aiPrompt,
          action: "generate",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate query");
      }

      const result = await response.json();
      setQuery(result.data.sqlQuery);
      setShowAiPanel(false);
      setAiPrompt("");
      
      toast({
        title: "Query generated",
        description: result.data.explanation,
      });
    } catch (error: any) {
      toast({
        title: "Generation failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const addNewTab = () => {
    const newId = String(queryTabs.length + 1);
    setQueryTabs([
      ...queryTabs.map(t => ({ ...t, active: false })),
      { id: newId, title: `Query ${newId}`, query: "", active: true },
    ]);
    setActiveTab(newId);
    setQuery("");
  };

  const closeTab = (tabId: string) => {
    if (queryTabs.length === 1) return;
    
    const newTabs = queryTabs.filter(t => t.id !== tabId);
    if (activeTab === tabId) {
      setActiveTab(newTabs[0].id);
      setQuery(newTabs[0].query);
    }
    setQueryTabs(newTabs);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 p-4 border-b">
        <div className="flex items-center gap-2">
          <Select value={selectedConnection} onValueChange={setSelectedConnection}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select connection" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="conn1">Production DB</SelectItem>
              <SelectItem value="conn2">Staging DB</SelectItem>
              <SelectItem value="conn3">Development DB</SelectItem>
            </SelectContent>
          </Select>

          <Button
            onClick={handleExecute}
            disabled={isExecuting || !selectedConnection}
            className="gap-2"
          >
            <Play className="h-4 w-4" />
            {isExecuting ? "Executing..." : "Execute"}
          </Button>

          <Button variant="outline" onClick={handleSave} className="gap-2">
            <Save className="h-4 w-4" />
            Save
          </Button>

          <Button
            variant="outline"
            onClick={() => setShowAiPanel(!showAiPanel)}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            AI Generate
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <History className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* AI Panel */}
      {showAiPanel && (
        <Card className="m-4 p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Describe the query you want to generate..."
              className="flex-1 px-3 py-2 border rounded-md"
              onKeyDown={(e) => e.key === "Enter" && handleAiGenerate()}
            />
            <Button onClick={handleAiGenerate} disabled={isExecuting}>
              Generate
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowAiPanel(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* Query Tabs */}
      <div className="flex items-center gap-2 px-4 pt-2 border-b">
        {queryTabs.map((tab) => (
          <div
            key={tab.id}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-t-md cursor-pointer",
              tab.id === activeTab
                ? "bg-background border-t border-x"
                : "bg-muted hover:bg-muted/80"
            )}
            onClick={() => {
              setActiveTab(tab.id);
              setQuery(tab.query);
            }}
          >
            <span className="text-sm">{tab.title}</span>
            {queryTabs.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="hover:bg-background rounded p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
        <Button
          variant="ghost"
          size="sm"
          onClick={addNewTab}
          className="h-7 px-2"
        >
          +
        </Button>
      </div>

      {/* Code Editor */}
      <div className="flex-1 overflow-hidden">
        <CodeMirror
          value={query}
          height="100%"
          theme={theme === "dark" ? oneDark : undefined}
          extensions={[sql()]}
          onChange={(value) => {
            setQuery(value);
            setQueryTabs(queryTabs.map(t => 
              t.id === activeTab ? { ...t, query: value } : t
            ));
          }}
          placeholder="Enter your SQL query here..."
        />
      </div>
    </div>
  );
}