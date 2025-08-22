"use client";

import { useState, useMemo } from "react";
import { Search, Database, Columns, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface TableInfo {
  schemaname?: string;
  schema?: string;
  tablename?: string;
  table?: string;
  table_name?: string;
  columns: string;
  table_comment?: string;
}

interface TableSelectorProps {
  tables: TableInfo[];
  onSelect: (table: TableInfo) => void;
  onCancel: () => void;
  searchKeywords?: string[];
}

export function TableSelector({ tables, onSelect, onCancel, searchKeywords = [] }: TableSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTable, setSelectedTable] = useState<{
    schema: string;
    name: string;
    columns: string;
    comment: string;
    original: TableInfo;
    highlighted?: boolean;
  } | null>(null);

  // Normalize table data
  const normalizedTables = useMemo(() => {
    return tables.map(table => ({
      schema: table.schemaname || table.schema || "public",
      name: table.tablename || table.table || table.table_name || "",
      columns: table.columns || "",
      comment: table.table_comment || "",
      original: table,
    }));
  }, [tables]);

  // Filter and highlight tables
  const filteredTables = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    const keywordsLower = searchKeywords.map(k => k.toLowerCase());
    
    return normalizedTables.filter(table => {
      const nameMatch = table.name.toLowerCase().includes(searchLower);
      const columnsMatch = table.columns.toLowerCase().includes(searchLower);
      const commentMatch = table.comment.toLowerCase().includes(searchLower);
      
      return nameMatch || columnsMatch || commentMatch;
    }).map(table => {
      // Check if table matches any keywords
      const matchesKeywords = keywordsLower.some(keyword => 
        table.name.toLowerCase().includes(keyword) ||
        table.columns.toLowerCase().includes(keyword)
      );
      
      return {
        ...table,
        highlighted: matchesKeywords,
      };
    }).sort((a, b) => {
      // Sort highlighted tables first
      if (a.highlighted && !b.highlighted) return -1;
      if (!a.highlighted && b.highlighted) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [normalizedTables, searchTerm, searchKeywords]);

  const handleSelect = () => {
    if (selectedTable) {
      onSelect(selectedTable.original);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Select a Table
        </CardTitle>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tables by name, columns, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-2">
            {filteredTables.map((table, index) => (
              <Card
                key={`${table.schema}.${table.name}-${index}`}
                className={cn(
                  "cursor-pointer transition-all hover:bg-accent/50",
                  selectedTable?.original === table.original && "border-primary bg-accent",
                  table.highlighted && "border-primary/50"
                )}
                onClick={() => setSelectedTable(table)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-sm">
                          {table.schema !== "public" && (
                            <span className="text-muted-foreground">{table.schema}.</span>
                          )}
                          {table.name}
                        </h4>
                        {table.highlighted && (
                          <Badge variant="secondary" className="text-xs">
                            Recommended
                          </Badge>
                        )}
                      </div>
                      {table.comment && (
                        <p className="text-xs text-muted-foreground mt-1">{table.comment}</p>
                      )}
                      <div className="mt-2">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Columns className="h-3 w-3" />
                          <span className="truncate">{table.columns}</span>
                        </div>
                      </div>
                    </div>
                    {selectedTable?.original === table.original && (
                      <CheckCircle className="h-5 w-5 text-primary shrink-0" />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
        
        <div className="flex gap-2 mt-4">
          <Button
            variant="default"
            onClick={handleSelect}
            disabled={!selectedTable}
            className="flex-1"
          >
            Use Selected Table
          </Button>
          <Button
            variant="outline"
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}