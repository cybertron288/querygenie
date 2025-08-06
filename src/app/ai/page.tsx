"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Send,
  Copy,
  Play,
  Save,
  Sparkles,
  Bot,
  User,
  Database,
  Info,
  AlertCircle,
  CheckCircle,
  Loader2,
  RefreshCw,
  Settings,
  Plus,
  MessageSquare,
  Trash2,
  Edit,
  Clock,
  ChevronLeft,
  ChevronRight,
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

// Utility function for relative time
function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  
  // For older than a week, show the date
  return date.toLocaleDateString();
}

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sql?: string;
  explanation?: string;
  confidence?: number;
  timestamp: Date;
  error?: string;
}

interface Connection {
  id: string;
  name: string;
  type: string;
  database: string;
}

interface Conversation {
  id: string;
  title: string;
  description?: string;
  isActive: boolean;
  messageCount: number;
  lastActivityAt: Date;
  createdAt: Date;
  connection: {
    id: string;
    name: string;
    type: string;
    database: string;
  };
}

export default function AIAssistantPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { theme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // State - Messages are loaded from current conversation
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [includeSchema, setIncludeSchema] = useState(true);
  const [availableModels, setAvailableModels] = useState<Record<string, boolean>>({});
  const [isCheckingKeys, setIsCheckingKeys] = useState(true);

  // State for connections
  const [connections, setConnections] = useState<Connection[]>([]);
  const [isLoadingConnections, setIsLoadingConnections] = useState(true);

  // State for conversations
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [showConversationSidebar, setShowConversationSidebar] = useState(true);

  // Get workspace ID from session - using the first workspace from memberships
  // Use the Acme Corp workspace ID which has the connections
  const workspaceId = session?.workspaces?.[0]?.id || session?.user?.memberships?.[0]?.workspaceId || "ddd3f516-4520-4987-b14e-768b9092d2f8";

  // Check for available API keys on mount
  useEffect(() => {
    const checkApiKeys = async () => {
      try {
        const response = await fetch("/api/settings/api-keys/check");
        if (response.ok) {
          const data = await response.json();
          setAvailableModels(data.availableModels);
          
          // If no keys available, redirect to API keys page
          if (!data.hasAnyKey) {
            router.push("/api-keys?setup=true");
            return;
          }
          
          // Set default model to first available one
          const availableModelKeys = Object.entries(data.availableModels)
            .filter(([_, available]) => available)
            .map(([key]) => key);
          
          if (availableModelKeys.length > 0) {
            setSelectedModel(availableModelKeys[0]);
          }
        }
      } catch (error) {
        console.error("Failed to check API keys:", error);
      } finally {
        setIsCheckingKeys(false);
      }
    };
    
    checkApiKeys();
  }, [router]);

  // Load connections
  useEffect(() => {
    const loadConnections = async () => {
      if (!session) return;
      
      try {
        const response = await fetch(`/api/connections?workspaceId=${workspaceId}`);
        
        if (response.ok) {
          const data = await response.json();
          const formattedConnections = data.connections.map((conn: any) => ({
            id: conn.id,
            name: conn.name,
            type: conn.type,
            database: conn.database,
          }));
          setConnections(formattedConnections);
          
          // Check if current selectedConnection is still available
          const isCurrentConnectionValid = selectedConnection && 
            formattedConnections.some((conn: any) => conn.id === selectedConnection);
          
          // Set first connection as default if no valid selection
          if (formattedConnections.length > 0 && (!selectedConnection || !isCurrentConnectionValid)) {
            setSelectedConnection(formattedConnections[0].id);
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

  // Load conversations for selected connection
  useEffect(() => {
    const loadConversations = async () => {
      if (!session || !selectedConnection || !workspaceId) return;
      
      setIsLoadingConversations(true);
      try {
        const response = await fetch(
          `/api/conversations?workspaceId=${workspaceId}&connectionId=${selectedConnection}`
        );
        
        if (response.ok) {
          const data = await response.json();
          const formattedConversations = data.conversations.map((conv: any) => ({
            ...conv,
            lastActivityAt: new Date(conv.lastActivityAt),
            createdAt: new Date(conv.createdAt),
          }));
          
          setConversations(formattedConversations);
          
          // Set active conversation as current, or create new one if none exists
          const activeConversation = formattedConversations.find((c: Conversation) => c.isActive);
          if (activeConversation) {
            setCurrentConversation(activeConversation);
          } else if (formattedConversations.length === 0) {
            // Create first conversation for this connection
            await createNewConversation();
          } else {
            // Set first conversation as current
            setCurrentConversation(formattedConversations[0]);
          }
        }
      } catch (error) {
        console.error("Failed to load conversations:", error);
      } finally {
        setIsLoadingConversations(false);
      }
    };

    loadConversations();
  }, [session, selectedConnection, workspaceId]);

  // Load messages when current conversation changes
  useEffect(() => {
    const loadMessages = async () => {
      if (!currentConversation) {
        setMessages([]);
        return;
      }
      
      try {
        const response = await fetch(`/api/conversations/${currentConversation.id}`);
        
        if (response.ok) {
          const data = await response.json();
          const formattedMessages = data.messages.map((msg: any) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            sql: msg.sqlQuery,
            explanation: msg.explanation,
            confidence: msg.confidence,
            timestamp: new Date(msg.createdAt),
            error: msg.error,
          }));
          
          setMessages(formattedMessages);
        }
      } catch (error) {
        console.error("Failed to load messages:", error);
        setMessages([]);
      }
    };

    loadMessages();
  }, [currentConversation]);

  // Create new conversation
  const createNewConversation = async (title?: string) => {
    if (!selectedConnection) {
      console.error("No connection selected");
      return;
    }
    
    // Validate that the selected connection exists in our connections list
    const connectionExists = connections.some(conn => conn.id === selectedConnection);
    if (!connectionExists) {
      console.error("Selected connection not found in available connections");
      // Reset to first available connection
      if (connections.length > 0) {
        setSelectedConnection(connections[0].id);
        return;
      }
      return;
    }
    
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: selectedConnection,
          title,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const newConversation = {
          ...data.conversation,
          lastActivityAt: new Date(data.conversation.lastActivityAt),
          createdAt: new Date(data.conversation.createdAt),
        };
        
        setConversations(prev => [newConversation, ...prev]);
        setCurrentConversation(newConversation);
      } else {
        const errorData = await response.json();
        console.error("Failed to create conversation:", errorData.error);
        
        // If connection not found, refresh connections and reset selection
        if (errorData.error?.includes("Connection not found")) {
          window.location.reload(); // Force refresh to reload connections
        }
      }
    } catch (error) {
      console.error("Failed to create conversation:", error);
    }
  };

  // Switch to conversation
  const switchToConversation = async (conversationId: string) => {
    const conversation = conversations.find(c => c.id === conversationId);
    if (!conversation) return;

    // Activate the conversation
    try {
      await fetch(`/api/conversations/${conversationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      });

      // Update local state
      setConversations(prev => prev.map(c => ({
        ...c,
        isActive: c.id === conversationId
      })));
      
      setCurrentConversation({ ...conversation, isActive: true });
    } catch (error) {
      console.error("Failed to switch conversation:", error);
    }
  };

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || isGenerating || !currentConversation) return;

    // Create user message optimistically
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = inputValue;
    setInputValue("");
    setIsGenerating(true);

    try {
      // Call AI API to generate SQL (now saves to conversation automatically)
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: currentInput,
          connectionId: selectedConnection,
          conversationId: currentConversation.id,
          model: selectedModel,
          includeSchema,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate query");
      }

      const data = await response.json();

      // Create assistant message optimistically (already saved to DB by API)
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.explanation || "Here's the SQL query I generated:",
        sql: data.sql,
        explanation: data.explanation,
        confidence: data.confidence,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Update conversation activity locally
      if (currentConversation) {
        setConversations(prev => prev.map(c => 
          c.id === currentConversation.id 
            ? { ...c, lastActivityAt: new Date(), messageCount: c.messageCount + 2 }
            : c
        ));
        setCurrentConversation(prev => prev ? {
          ...prev,
          lastActivityAt: new Date(),
          messageCount: prev.messageCount + 2,
        } : null);
      }

    } catch (error: any) {
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: "I encountered an error while generating the query. Please try again.",
        error: error.message,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);

      // Try to save error message to conversation
      try {
        await fetch(`/api/conversations/${currentConversation.id}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: 'assistant',
            content: errorMessage.content,
            error: error.message,
          }),
        });
      } catch (saveError) {
        console.error("Failed to save error message:", saveError);
      }
    } finally {
      setIsGenerating(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopySQL = (sql: string) => {
    navigator.clipboard.writeText(sql);
    // You could add a toast notification here
  };

  const handleExecuteSQL = (sql: string) => {
    // Navigate to editor with the SQL pre-filled
    const params = new URLSearchParams();
    params.set("sql", sql);
    params.set("connectionId", selectedConnection);
    router.push(`/editor?${params.toString()}`);
  };

  const handleClearChat = () => {
    const clearedMessages: Message[] = [
      {
        id: "1",
        role: "assistant" as const,
        content: "Chat cleared. How can I help you with SQL queries?",
        timestamp: new Date(),
      },
    ];
    setMessages(clearedMessages);
    localStorage.removeItem("ai-chat-history");
  };

  // Show loading state while checking API keys
  if (isCheckingKeys) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar 
          isOpen={sidebarOpen} 
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
          
          <main className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Checking API configuration...</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar 
        isOpen={sidebarOpen} 
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        
        <main className="flex-1 overflow-hidden">
          <div className="h-full flex">
            {/* Conversation Sidebar */}
            {showConversationSidebar && (
              <div className="w-80 border-r bg-muted/30 flex flex-col">
                <div className="p-4 border-b">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Conversations
                    </h3>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => createNewConversation()}
                        disabled={!selectedConnection}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowConversationSidebar(false)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {selectedConnection && (
                    <div className="text-xs text-muted-foreground">
                      {connections.find(c => c.id === selectedConnection)?.name}
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-auto p-2">
                  {isLoadingConversations ? (
                    <div className="flex items-center justify-center h-32">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : conversations.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">
                        No conversations yet.{' '}
                        <Button
                          variant="link"
                          size="sm"
                          className="p-0 h-auto"
                          onClick={() => createNewConversation()}
                        >
                          Start one!
                        </Button>
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {conversations.map((conversation) => (
                        <Card
                          key={conversation.id}
                          className={cn(
                            "cursor-pointer transition-colors hover:bg-accent/50",
                            conversation.isActive || conversation.id === currentConversation?.id
                              ? "bg-accent border-primary/50"
                              : ""
                          )}
                          onClick={() => switchToConversation(conversation.id)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-sm truncate">
                                  {conversation.title}
                                </h4>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="secondary" className="text-xs">
                                    {conversation.messageCount} msg
                                  </Badge>
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {getRelativeTime(conversation.lastActivityAt)}
                                  </span>
                                </div>
                              </div>
                              {conversation.isActive && (
                                <div className="h-2 w-2 bg-green-500 rounded-full" />
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}


            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Top Controls */}
              <div className="border-b bg-background/95 backdrop-blur p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    {!showConversationSidebar && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowConversationSidebar(true)}
                        className="p-2"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    )}
                    <Sparkles className="h-5 w-5 text-primary" />
                    <h1 className="text-lg font-semibold">AI SQL Assistant</h1>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <Select 
                      value={selectedConnection} 
                      onValueChange={setSelectedConnection}
                      disabled={isLoadingConnections || connections.length === 0}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder={
                          isLoadingConnections ? "Loading..." : 
                          connections.length === 0 ? "No connections" : 
                          "Select database"
                        } />
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
                                <Database className="h-4 w-4" />
                                {conn.name}
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>

                    <Select value={selectedModel} onValueChange={setSelectedModel} disabled={isCheckingKeys}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableModels.gemini && (
                          <SelectItem value="gemini">
                            <div className="flex items-center gap-2">
                              <Badge variant="default" className="text-xs">Free</Badge>
                              Gemini
                            </div>
                          </SelectItem>
                        )}
                        {availableModels["gpt-3.5-turbo"] && (
                          <SelectItem value="gpt-3.5-turbo">GPT-3.5</SelectItem>
                        )}
                        {availableModels["gpt-4"] && (
                          <SelectItem value="gpt-4">GPT-4</SelectItem>
                        )}
                        {availableModels.claude && (
                          <SelectItem value="claude">Claude 3</SelectItem>
                        )}
                        {Object.values(availableModels).every(v => !v) && (
                          <div className="p-2 text-sm text-muted-foreground">
                            No API keys configured
                          </div>
                        )}
                      </SelectContent>
                    </Select>

                    <Button variant="outline" size="sm" onClick={handleClearChat}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Clear
                    </Button>
                  </div>
                </div>
              </div>

              {/* Chat Messages */}
              <ScrollArea className="flex-1 p-4">
              <div className="max-w-4xl mx-auto space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-3",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {message.role === "assistant" && (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Bot className="h-5 w-5 text-primary" />
                      </div>
                    )}
                    
                    <div
                      className={cn(
                        "max-w-[70%] space-y-2",
                        message.role === "user" ? "items-end" : "items-start"
                      )}
                    >
                      <div
                        className={cn(
                          "rounded-lg px-4 py-2",
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        )}
                      >
                        <p className="text-sm">{message.content}</p>
                      </div>

                      {message.sql && (
                        <Card>
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm">Generated SQL</CardTitle>
                              <div className="flex items-center gap-2">
                                {message.confidence && (
                                  <Badge variant="outline" className="text-xs">
                                    {message.confidence}% confidence
                                  </Badge>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCopySQL(message.sql!)}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleExecuteSQL(message.sql!)}
                                >
                                  <Play className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <CodeMirror
                              value={message.sql}
                              extensions={[sql()]}
                              theme={oneDark}
                              editable={false}
                              basicSetup={{
                                lineNumbers: true,
                                highlightActiveLine: false,
                                highlightSelectionMatches: false,
                                searchKeymap: false,
                              }}
                              className="text-sm"
                            />
                          </CardContent>
                        </Card>
                      )}

                      {message.error && (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Error</AlertTitle>
                          <AlertDescription>{message.error}</AlertDescription>
                        </Alert>
                      )}

                      <p className="text-xs text-muted-foreground">
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>

                    {message.role === "user" && (
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                        <User className="h-5 w-5 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                ))}
                
                {isGenerating && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="h-5 w-5 text-primary animate-pulse" />
                    </div>
                    <div className="bg-muted rounded-lg px-4 py-2">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Generating SQL query...</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
              </ScrollArea>

              {/* Input Area */}
              <div className="border-t bg-background p-4">
                <div className="max-w-4xl mx-auto">
                  <div className="flex gap-4">
                    <Textarea
                      ref={inputRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Describe the query you want in natural language... (e.g., 'Show me all users who signed up last month')"
                      className="flex-1 min-h-[60px] max-h-[200px] resize-none"
                      disabled={isGenerating}
                    />
                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={handleSend}
                        disabled={!inputValue.trim() || isGenerating}
                        className="h-full"
                      >
                        {isGenerating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 mt-2">
                    <p className="text-xs text-muted-foreground">
                      Press Enter to send, Shift+Enter for new line
                    </p>
                    {selectedModel === "gemini" && (
                      <Badge variant="outline" className="text-xs">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Using free Gemini API
                      </Badge>
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