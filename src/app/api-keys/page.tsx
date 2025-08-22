"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { 
  Key, 
  Eye, 
  EyeOff, 
  Plus, 
  Trash2, 
  AlertCircle,
  CheckCircle,
  Sparkles,
  Bot,
  Brain,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ApiKey {
  id: string;
  name: string;
  provider: "gemini" | "openai" | "anthropic";
  key: string;
  isActive: boolean;
  lastUsed: Date | null;
  createdAt: Date;
}

const providerInfo = {
  gemini: {
    name: "Google Gemini",
    icon: Sparkles,
    description: "Free tier available",
    models: ["gemini-pro"],
    docsUrl: "https://makersuite.google.com/app/apikey",
    color: "text-blue-500",
  },
  openai: {
    name: "OpenAI",
    icon: Bot,
    description: "GPT-3.5 & GPT-4",
    models: ["gpt-3.5-turbo", "gpt-4"],
    docsUrl: "https://platform.openai.com/api-keys",
    color: "text-green-500",
  },
  anthropic: {
    name: "Anthropic",
    icon: Brain,
    description: "Claude 3",
    models: ["claude-3-sonnet", "claude-3-opus"],
    docsUrl: "https://console.anthropic.com/settings/keys",
    color: "text-purple-500",
  },
};

function ApiKeysContent() {
  const searchParams = useSearchParams();
  const isSetup = searchParams.get("setup") === "true";
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form state for new key
  const [newKey, setNewKey] = useState({
    name: "",
    provider: "gemini" as keyof typeof providerInfo,
    key: "",
  });

  // Load API keys on mount
  useEffect(() => {
    loadApiKeys();
  }, []);

  const loadApiKeys = async () => {
    try {
      const response = await fetch("/api/settings/api-keys");
      if (response.ok) {
        const data = await response.json();
        setApiKeys(data.keys || []);
      }
    } catch (error) {
      console.error("Failed to load API keys:", error);
    }
  };

  const handleAddKey = async () => {
    if (!newKey.name || !newKey.key) {
      setMessage({ type: "error", text: "Please fill in all fields" });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newKey),
      });

      if (response.ok) {
        const data = await response.json();
        setApiKeys([...apiKeys, data.key]);
        setIsAddDialogOpen(false);
        setNewKey({ name: "", provider: "gemini", key: "" });
        setMessage({ type: "success", text: "API key added successfully" });
      } else {
        throw new Error("Failed to add API key");
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to add API key" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm("Are you sure you want to delete this API key?")) return;

    try {
      const response = await fetch(`/api/settings/api-keys/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setApiKeys(apiKeys.filter(key => key.id !== id));
        setMessage({ type: "success", text: "API key deleted" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to delete API key" });
    }
  };

  const handleToggleKey = async (id: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/settings/api-keys/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });

      if (response.ok) {
        setApiKeys(apiKeys.map(key => 
          key.id === id ? { ...key, isActive: !isActive } : key
        ));
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to update API key" });
    }
  };

  const maskApiKey = (key: string) => {
    if (key.length <= 8) return "••••••••";
    return `${key.substring(0, 4)}••••••••${key.substring(key.length - 4)}`;
  };

  // Clear message after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
    return undefined;
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
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">API Keys</h1>
                <p className="text-muted-foreground mt-1">
                  Manage your AI provider API keys for query generation
                </p>
              </div>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add API Key
              </Button>
            </div>

            {/* Setup Message */}
            {isSetup && apiKeys.length === 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>API Key Required</AlertTitle>
                <AlertDescription>
                  To use the AI Assistant, you need to configure at least one API key. 
                  Gemini offers a free tier that's perfect for getting started.
                </AlertDescription>
              </Alert>
            )}

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

            {/* Provider Cards */}
            <div className="grid gap-6 md:grid-cols-3">
              {Object.entries(providerInfo).map(([key, info]) => {
                const Icon = info.icon;
                const hasKey = apiKeys.some(k => k.provider === key && k.isActive);
                
                return (
                  <Card key={key}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <Icon className={`h-8 w-8 ${info.color}`} />
                        {hasKey && (
                          <Badge variant="outline" className="text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        )}
                      </div>
                      <CardTitle>{info.name}</CardTitle>
                      <CardDescription>{info.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="text-sm text-muted-foreground">
                          Supported models:
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {info.models.map(model => (
                            <Badge key={model} variant="secondary" className="text-xs">
                              {model}
                            </Badge>
                          ))}
                        </div>
                        <Button
                          variant="link"
                          size="sm"
                          className="px-0"
                          onClick={() => window.open(info.docsUrl, "_blank")}
                        >
                          Get API Key →
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* API Keys List */}
            <Card>
              <CardHeader>
                <CardTitle>Your API Keys</CardTitle>
                <CardDescription>
                  {apiKeys.length === 0 
                    ? "No API keys configured. Add one to start using AI features."
                    : `${apiKeys.length} API key${apiKeys.length === 1 ? "" : "s"} configured`
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                {apiKeys.length === 0 ? (
                  <div className="text-center py-8">
                    <Key className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">
                      No API keys configured yet
                    </p>
                    <Button onClick={() => setIsAddDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Your First Key
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {apiKeys.map((apiKey) => {
                      const info = providerInfo[apiKey.provider];
                      const Icon = info.icon;
                      
                      return (
                        <div
                          key={apiKey.id}
                          className="flex items-center justify-between p-4 border rounded-lg"
                        >
                          <div className="flex items-center gap-4">
                            <Icon className={`h-5 w-5 ${info.color}`} />
                            <div>
                              <div className="font-medium">{apiKey.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {info.name} • Added {new Date(apiKey.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <code className="text-sm bg-muted px-2 py-1 rounded">
                                {showKeys[apiKey.id] ? apiKey.key : maskApiKey(apiKey.key)}
                              </code>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowKeys({
                                  ...showKeys,
                                  [apiKey.id]: !showKeys[apiKey.id]
                                })}
                              >
                                {showKeys[apiKey.id] ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                            
                            <Badge
                              variant={apiKey.isActive ? "default" : "secondary"}
                              className="cursor-pointer"
                              onClick={() => handleToggleKey(apiKey.id, apiKey.isActive)}
                            >
                              {apiKey.isActive ? "Active" : "Inactive"}
                            </Badge>
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteKey(apiKey.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* Add API Key Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add API Key</DialogTitle>
            <DialogDescription>
              Add your AI provider API key to enable query generation
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Key Name</Label>
              <Input
                id="name"
                placeholder="e.g., Production Gemini Key"
                value={newKey.name}
                onChange={(e) => setNewKey({ ...newKey, name: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="provider">Provider</Label>
              <Select
                value={newKey.provider}
                onValueChange={(value) => setNewKey({ ...newKey, provider: value as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(providerInfo).map(([key, info]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <info.icon className={`h-4 w-4 ${info.color}`} />
                        {info.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="key">API Key</Label>
              <Input
                id="key"
                type="password"
                placeholder="Enter your API key"
                value={newKey.key}
                onChange={(e) => setNewKey({ ...newKey, key: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Your API key will be encrypted and stored securely
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddKey} disabled={isSaving}>
              {isSaving ? "Adding..." : "Add Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ApiKeysPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    }>
      <ApiKeysContent />
    </Suspense>
  );
}