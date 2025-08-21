/**
 * Enhanced AI Query Generator with Schema Awareness
 * 
 * Generates SQL queries using actual database schema information
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { 
  SchemaInfo, 
  TableInfo, 
  findMatchingTables, 
  generateTableSuggestions,
  getSchemaInfo 
} from "@/lib/db/schema-introspection";

interface GenerateOptions {
  prompt: string;
  connectionType: string;
  connectionConfig?: any;
  connectionId?: string;
  schemaInfo?: SchemaInfo;
  conversationHistory?: Message[];
  model?: "gemini" | "claude" | "gpt4";
  temperature?: number;
  allowExecution?: boolean;
}

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface GeneratedResponse {
  type: "query" | "clarification" | "explanation" | "error" | "exploration";
  query?: string;
  explanation?: string;
  confidence?: number;
  suggestions?: TableInfo[];
  message?: string;
  requiresConfirmation?: boolean;
  explorationQuery?: string;
}

/**
 * Generate database-specific exploration query
 */
function getExplorationQuery(connectionType: string, userPrompt: string): { query: string; message: string } {
  const lowerPrompt = userPrompt.toLowerCase();
  
  // Extract schema name if mentioned - look for patterns like "from schema_name schema" or "in schema_name"
  let schemaName = null;
  
  // Try different patterns to extract schema name
  const patterns = [
    /from\s+(\w+)\s+schema/i,        // "from newmicare schema"
    /in\s+(\w+)\s+schema/i,          // "in newmicare schema"
    /(\w+)\s+schema/i,                // "newmicare schema"
    /schema\s+['"]*(\w+)['"]*,?/i,   // "schema 'newmicare'" or "schema newmicare,"
    /from\s+['"]*(\w+)['"]*\./i,     // "from newmicare.table"
  ];
  
  for (const pattern of patterns) {
    const match = userPrompt.match(pattern);
    if (match) {
      schemaName = match[1];
      break;
    }
  }
  
  // Determine what user is looking for
  const lookingForRoles = /role|permission|auth|user.*role/i.test(lowerPrompt);
  const lookingForUsers = /user|account|member|person/i.test(lowerPrompt);
  
  let query = "";
  let message = "I'll explore the database to find tables that might contain ";
  
  if (lookingForRoles) {
    message += "user role information.";
  } else if (lookingForUsers) {
    message += "user information.";
  } else {
    message += "the data you're looking for.";
  }
  
  switch (connectionType.toLowerCase()) {
    case "postgres":
    case "postgresql":
      if (schemaName) {
        // List ALL tables in the specified schema with their columns
        // First try exact match, then case-insensitive, then pattern match
        query = `
WITH schema_tables AS (
  SELECT 
    t.schemaname,
    t.tablename
  FROM pg_tables t
  WHERE t.schemaname = '${schemaName}'
     OR LOWER(t.schemaname) = LOWER('${schemaName}')
     OR t.schemaname ILIKE '%${schemaName}%'
  
  UNION
  
  SELECT 
    n.nspname as schemaname,
    c.relname as tablename  
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('r', 'v', 'm')
    AND (n.nspname = '${schemaName}'
     OR LOWER(n.nspname) = LOWER('${schemaName}')
     OR n.nspname ILIKE '%${schemaName}%')
)
SELECT DISTINCT
  st.schemaname,
  st.tablename,
  COALESCE(string_agg(DISTINCT c.column_name, ', ' ORDER BY c.column_name), '') as columns
FROM schema_tables st
LEFT JOIN information_schema.columns c 
  ON LOWER(c.table_schema) = LOWER(st.schemaname) 
  AND LOWER(c.table_name) = LOWER(st.tablename)
GROUP BY st.schemaname, st.tablename
ORDER BY st.schemaname, st.tablename
LIMIT 200`;
        message = `I'll list all tables in the ${schemaName} schema for you to choose from.`;
      } else {
        // List ALL tables from all user schemas
        query = `
SELECT 
  table_schema as schema,
  table_name as table,
  string_agg(column_name, ', ' ORDER BY ordinal_position) as columns
FROM information_schema.columns
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
GROUP BY table_schema, table_name
ORDER BY table_schema, table_name
LIMIT 200`;
        message = "I'll list all available tables for you to choose from.";
      }
      break;
      
    case "mysql":
      // For MySQL, check if a specific database/schema is mentioned
      let databaseClause = "c.TABLE_SCHEMA = DATABASE()";
      if (schemaName) {
        databaseClause = `c.TABLE_SCHEMA = '${schemaName}'`;
        message = `I'll list all tables in the ${schemaName} database for you to choose from.`;
      } else {
        message = "I'll list all tables in the current database for you to choose from.";
      }
      
      query = `
SELECT 
  TABLE_NAME as table_name,
  GROUP_CONCAT(COLUMN_NAME ORDER BY ORDINAL_POSITION) as columns,
  TABLE_COMMENT as table_comment
FROM INFORMATION_SCHEMA.COLUMNS c
LEFT JOIN INFORMATION_SCHEMA.TABLES t 
  ON c.TABLE_SCHEMA = t.TABLE_SCHEMA 
  AND c.TABLE_NAME = t.TABLE_NAME
WHERE ${databaseClause}
GROUP BY c.TABLE_NAME, t.TABLE_COMMENT
ORDER BY c.TABLE_NAME
LIMIT 200`;
      break;
      
    case "sqlite":
      query = `
SELECT 
  name as table_name,
  sql as table_definition
FROM sqlite_master 
WHERE type = 'table' 
ORDER BY name
LIMIT 200`;
      message = "I'll list all tables in the database for you to choose from.";
      break;
      
    default:
      // Generic SQL
      query = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' LIMIT 50";
  }
  
  return { query: query.trim(), message };
}

/**
 * Analyze user intent from the prompt
 */
function analyzeIntent(prompt: string): {
  isQuestion: boolean;
  wantsQuery: boolean;
  searchTerms: string[];
} {
  const lowerPrompt = prompt.toLowerCase();
  
  // Check if it's a question about the database
  const isQuestion = /^(what|how|where|when|why|which|show|list|get|find|I need|I want|can you|could you|please)/i.test(prompt.trim());
  
  // Check if user explicitly wants a query or is asking about tables/data
  const wantsQuery = 
    isQuestion ||
    /\b(select|query|sql|fetch|retrieve|show me|get me|give me|list|need|want|looking for|available|tables|check|examine)\b/i.test(lowerPrompt) ||
    /\b(yes|okay|sure|proceed|go ahead|do it|execute|run)\b/i.test(lowerPrompt); // Handle confirmations
  
  // Extract potential table/entity names
  const searchTerms: string[] = [];
  
  // Common database entities
  const entities = [
    'user', 'users', 'role', 'roles', 'permission', 'permissions',
    'product', 'products', 'order', 'orders', 'customer', 'customers',
    'employee', 'employees', 'department', 'departments',
    'account', 'accounts', 'transaction', 'transactions',
    'auth', 'authentication', 'session', 'sessions'
  ];
  
  // Extract mentioned entities
  for (const entity of entities) {
    if (lowerPrompt.includes(entity)) {
      searchTerms.push(entity);
    }
  }
  
  // Extract words that might be table names (camelCase, snake_case, etc.)
  const words = prompt.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g) || [];
  for (const word of words) {
    if (word.length > 2 && !['the', 'and', 'from', 'where', 'select'].includes(word.toLowerCase())) {
      searchTerms.push(word);
    }
  }
  
  return { isQuestion, wantsQuery, searchTerms };
}

/**
 * Build an intelligent system prompt with schema awareness
 */
function buildIntelligentPrompt(
  options: GenerateOptions,
  matchedTables: TableInfo[]
): string {
  let prompt = `You are a helpful SQL assistant for a ${options.connectionType} database.

CAPABILITIES:
- You can explore the database schema by suggesting queries to list tables, columns, etc.
- When the user asks for data but you need schema information first, provide an exploration query
- You can ONLY execute READ queries (SELECT, SHOW, DESCRIBE, etc.)
- NEVER execute or suggest write operations (INSERT, UPDATE, DELETE, DROP, etc.)

RESPONSE FORMAT:
When you need to explore the schema, respond with:
<exploration>
<message>Explanation of what you're looking for</message>
<query>The SQL query to explore the schema</query>
</exploration>

When you have enough information to generate the final query:
<query>
The SQL query
</query>
<explanation>
Brief explanation
</explanation>

When you need clarification:
<clarification>
Your question or clarification request
</clarification>

`;
  
  if (matchedTables.length > 0) {
    prompt += "Based on the user's request, here are the relevant tables in the database:\n\n";
    
    for (const table of matchedTables.slice(0, 3)) { // Show top 3 matches
      const fullName = table.schema ? `${table.schema}.${table.tableName}` : table.tableName;
      prompt += `Table: ${fullName}\n`;
      prompt += "Columns:\n";
      
      for (const col of table.columns.slice(0, 10)) { // Show first 10 columns
        prompt += `  - ${col.name} (${col.type})`;
        if (col.isPrimary) prompt += " [PRIMARY KEY]";
        if (col.isForeign) prompt += ` [FOREIGN KEY -> ${col.references?.table}]`;
        prompt += "\n";
      }
      
      if (table.columns.length > 10) {
        prompt += `  ... and ${table.columns.length - 10} more columns\n`;
      }
      prompt += "\n";
    }
  }
  
  prompt += `
IMPORTANT INSTRUCTIONS:
1. If user asks about tables/data but no schema information is available above:
   - Generate an exploration query to discover the schema
   - For PostgreSQL: Use information_schema or pg_catalog to list tables
   - For MySQL: Use SHOW TABLES or information_schema
   - Format response with <exploration> tags
2. Use the ACTUAL table and column names from the schema if available
3. If the user mentions "user roles", look for tables with names containing "user", "role", "auth", etc.
4. For PostgreSQL, include the schema name (e.g., schema.table)
5. Always add appropriate LIMIT clauses for safety
6. If multiple tables could match, ask for clarification

Database-specific exploration queries:
- PostgreSQL: SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'schema_name'
- MySQL: SHOW TABLES FROM database_name
- SQLite: SELECT name FROM sqlite_master WHERE type='table'

User's conversation history:
`;

  if (options.conversationHistory) {
    for (const msg of options.conversationHistory.slice(-5)) { // Last 5 messages
      prompt += `${msg.role}: ${msg.content}\n`;
    }
  }
  
  return prompt;
}

/**
 * Parse AI response intelligently
 */
function parseIntelligentResponse(text: string): GeneratedResponse {
  // Check for exploration format
  const explorationMatch = text.match(/<exploration>\s*<message>([\s\S]*?)<\/message>\s*<query>([\s\S]*?)<\/query>\s*<\/exploration>/);
  if (explorationMatch) {
    return {
      type: "exploration",
      explorationQuery: explorationMatch[2].trim(),
      message: explorationMatch[1].trim(),
      requiresConfirmation: true,
    };
  }
  
  // Check for query/explanation format
  const queryMatch = text.match(/<query>([\s\S]*?)<\/query>/);
  const explanationMatch = text.match(/<explanation>([\s\S]*?)<\/explanation>/);
  
  if (queryMatch) {
    return {
      type: "query",
      query: queryMatch[1].trim(),
      explanation: explanationMatch ? explanationMatch[1].trim() : "Query generated successfully",
      confidence: 85,
    };
  }
  
  // Check for clarification format
  const clarificationMatch = text.match(/<clarification>([\s\S]*?)<\/clarification>/);
  if (clarificationMatch) {
    return {
      type: "clarification",
      message: clarificationMatch[1].trim(),
    };
  }
  
  // Fallback: Check for SQL in code blocks
  const sqlMatch = text.match(/```sql\n?([\s\S]*?)```/);
  if (sqlMatch) {
    const query = sqlMatch[1].trim();
    const explanation = text.replace(/```sql\n?[\s\S]*?```/, '').trim();
    
    // Check if it's asking for execution confirmation
    const asksForExecution = /would you like (me )?to execute|shall I (run|execute)|execute this query/i.test(text);
    const isExploration = /list.*tables|show.*tables|explore.*schema|available tables/i.test(text);
    
    if (asksForExecution && isExploration) {
      return {
        type: "exploration",
        explorationQuery: query,
        message: explanation,
        requiresConfirmation: true,
      };
    }
    
    return {
      type: "query",
      query,
      explanation,
      confidence: 85,
    };
  }
  
  // Check if it's asking for clarification
  const isClarification = /which (table|one|database)|please (specify|clarify)|did you mean/i.test(text);
  if (isClarification) {
    return {
      type: "clarification",
      message: text,
    };
  }
  
  // Default to explanation
  return {
    type: "explanation",
    message: text,
  };
}

/**
 * Enhanced SQL query generation with schema awareness
 */
export async function generateEnhancedSQLQuery(
  options: GenerateOptions
): Promise<GeneratedResponse> {
  try {
    // Analyze user intent
    const intent = analyzeIntent(options.prompt);
    console.log("Intent analysis:", intent);
    
    // Get schema information if not provided
    let schemaInfo = options.schemaInfo;
    if (!schemaInfo && options.connectionConfig) {
      try {
        schemaInfo = await getSchemaInfo(options.connectionType, options.connectionConfig);
      } catch (error) {
        console.error("Failed to fetch schema:", error);
      }
    }
    
    // Find matching tables
    let matchedTables: TableInfo[] = [];
    if (schemaInfo && intent.searchTerms.length > 0) {
      matchedTables = findMatchingTables(schemaInfo, intent.searchTerms);
      
      // If no exact matches, try partial matching
      if (matchedTables.length === 0) {
        const partialTerms = intent.searchTerms.flatMap(term => 
          term.split(/[_\-]/)
        );
        matchedTables = findMatchingTables(schemaInfo, partialTerms);
      }
    }
    
    console.log("Matched tables:", matchedTables.length);
    
    // If user is asking about tables but we found multiple matches
    if (intent.wantsQuery && matchedTables.length > 1) {
      const suggestions = generateTableSuggestions(matchedTables);
      
      // Still generate a query with the best match, but include suggestions
      const response = await callAIModel(options, matchedTables);
      return {
        ...response,
        suggestions: matchedTables.slice(0, 5),
        message: suggestions + "\n\nI've generated a query using the most likely table:",
      };
    }
    
    // If user wants a query but we have no matching tables OR no schema info, suggest exploration
    // Also trigger if user is specifically asking about tables/schema
    const asksAboutTables = /\b(tables?|schema|database|available|show|list|check)\b/i.test(options.prompt.toLowerCase());
    
    if ((intent.wantsQuery && (matchedTables.length === 0 || !schemaInfo)) || asksAboutTables) {
      // No schema info at all, or no matching tables, or user asking about schema - suggest exploration
      const dbSpecificQuery = getExplorationQuery(options.connectionType, options.prompt);
      console.log("Generated exploration query:", dbSpecificQuery);
      console.log("SchemaInfo available:", !!schemaInfo, "Matched tables:", matchedTables.length);
      
      // Return the exploration response directly without calling AI
      return {
        type: "exploration",
        explorationQuery: dbSpecificQuery.query,
        message: dbSpecificQuery.message,
        requiresConfirmation: true,
      };
    }
    
    // Generate response using AI
    return await callAIModel(options, matchedTables);
    
  } catch (error: any) {
    console.error("Enhanced query generation error:", error);
    return {
      type: "error",
      message: `Failed to generate query: ${error.message}`,
    };
  }
}

/**
 * Call the appropriate AI model
 */
async function callAIModel(
  options: GenerateOptions,
  matchedTables: TableInfo[]
): Promise<GeneratedResponse> {
  const model = options.model || "gemini";
  
  switch (model) {
    case "gemini":
      return await generateWithGemini(options, matchedTables);
    default:
      throw new Error(`Unsupported model: ${model}`);
  }
}

/**
 * Generate with Gemini
 */
async function generateWithGemini(
  options: GenerateOptions,
  matchedTables: TableInfo[]
): Promise<GeneratedResponse> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  
  if (!apiKey) {
    throw new Error("Gemini API key not configured");
  }
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    generationConfig: {
      temperature: options.temperature || 0.3,
      maxOutputTokens: 2048,
    },
  });
  
  const systemPrompt = buildIntelligentPrompt(options, matchedTables);
  const fullPrompt = `${systemPrompt}\n\nUser: ${options.prompt}\n\nAssistant:`;
  
  try {
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();
    
    return parseIntelligentResponse(text);
  } catch (error: any) {
    console.error("Gemini error:", error);
    throw new Error(`Gemini generation failed: ${error.message}`);
  }
}