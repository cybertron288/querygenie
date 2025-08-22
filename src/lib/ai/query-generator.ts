/**
 * AI Query Generator
 * 
 * Generates SQL queries using AI models (Gemini, Claude, GPT-4)
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

interface GenerateOptions {
  prompt: string;
  connectionType: string;
  model?: "gemini" | "claude" | "gpt4";
  includeExamples?: boolean;
  temperature?: number;
  schema?: Record<string, any>;
}

interface GeneratedQuery {
  query: string;
  explanation: string;
  confidence: number;
}

/**
 * Generate SQL query using AI
 */
export async function generateSQLQuery(
  options: GenerateOptions
): Promise<GeneratedQuery> {
  const model = options.model || "gemini"; // Default to free Gemini

  switch (model) {
    case "gemini":
      return await generateWithGemini(options);
    case "claude":
      return await generateWithClaude(options);
    case "gpt4":
      return await generateWithGPT4(options);
    default:
      throw new Error(`Unsupported AI model: ${model}`);
  }
}

/**
 * Generate query using Google Gemini (free tier)
 */
async function generateWithGemini(
  options: GenerateOptions
): Promise<GeneratedQuery> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  
  if (!apiKey) {
    throw new Error("Gemini API key not configured");
  }

  console.log("Using Gemini API with key:", apiKey.substring(0, 10) + "...", "Model: gemini-1.5-flash");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash", // Updated model name - gemini-pro is deprecated
    generationConfig: {
      temperature: options.temperature || 0.2,
      topK: 1,
      topP: 1,
      maxOutputTokens: 2048,
    },
  });

  const systemPrompt = buildSystemPrompt(options);
  const userPrompt = `${systemPrompt}\n\nUser request: ${options.prompt}`;

  try {
    console.log("Sending prompt to Gemini:", userPrompt.substring(0, 200) + "...");
    const result = await model.generateContent(userPrompt);
    const response = await result.response;
    const text = response.text();
    
    console.log("Gemini response received, length:", text.length);
    
    // Parse the response
    const parsed = parseAIResponse(text);
    
    return {
      query: parsed.query,
      explanation: parsed.explanation,
      confidence: 80, // Gemini doesn't provide confidence scores (0-100 scale)
    };
  } catch (error: any) {
    console.error("Gemini generation error details:", {
      message: error.message,
      stack: error.stack,
      response: error.response,
    });
    throw new Error(`Failed to generate query with Gemini: ${error.message}`);
  }
}

/**
 * Generate query using Claude (requires API key)
 */
async function generateWithClaude(
  options: GenerateOptions
): Promise<GeneratedQuery> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    throw new Error("Claude API key not configured. Please provide your API key.");
  }

  const systemPrompt = buildSystemPrompt(options);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-sonnet-20240229",
        max_tokens: 2048,
        temperature: options.temperature || 0.2,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: options.prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${error}`);
    }

    const data = await response.json();
    const text = data.content[0].text;
    
    // Parse the response
    const parsed = parseAIResponse(text);
    
    return {
      query: parsed.query,
      explanation: parsed.explanation,
      confidence: 90, // Claude generally has high confidence (0-100 scale)
    };
  } catch (error: any) {
    console.error("Claude generation error:", error);
    throw new Error(`Failed to generate query with Claude: ${error.message}`);
  }
}

/**
 * Generate query using GPT-4 (requires API key)
 */
async function generateWithGPT4(
  options: GenerateOptions
): Promise<GeneratedQuery> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error("OpenAI API key not configured. Please provide your API key.");
  }

  const systemPrompt = buildSystemPrompt(options);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: options.prompt,
          },
        ],
        temperature: options.temperature || 0.2,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();
    const text = data.choices[0].message.content;
    
    // Parse the response
    const parsed = parseAIResponse(text);
    
    return {
      query: parsed.query,
      explanation: parsed.explanation,
      confidence: 85, // GPT-4 confidence (0-100 scale)
    };
  } catch (error: any) {
    console.error("GPT-4 generation error:", error);
    throw new Error(`Failed to generate query with GPT-4: ${error.message}`);
  }
}

/**
 * Build system prompt for AI models
 */
function buildSystemPrompt(options: GenerateOptions): string {
  const dbType = options.connectionType.toUpperCase();
  
  let prompt = `You are an expert SQL query generator for ${dbType} databases.
Your task is to generate accurate, efficient, and safe SQL queries based on user requests.

Rules:
1. Generate only valid ${dbType} SQL syntax
2. Use proper escaping for identifiers and values
3. Optimize queries for performance
4. Include appropriate indexes hints when beneficial
5. Never generate queries that could damage data without explicit user request
6. Always use LIMIT for SELECT queries unless specifically asked for all results
7. Format the SQL query for readability

Response format:
<query>
[Your SQL query here]
</query>

<explanation>
[Brief explanation of what the query does and any important notes]
</explanation>`;

  // Add schema context if available
  if (options.schema && Object.keys(options.schema).length > 0) {
    prompt += "\n\nDatabase Schema:\n";
    prompt += formatSchemaForPrompt(options.schema);
  }

  // Add examples if requested
  if (options.includeExamples) {
    prompt += "\n\nExamples:\n";
    prompt += getExampleQueries(options.connectionType);
  }

  return prompt;
}

/**
 * Format schema for AI prompt
 */
function formatSchemaForPrompt(schema: Record<string, any>): string {
  let formatted = "";
  
  for (const [tableName, tableInfo] of Object.entries(schema)) {
    formatted += `\nTable: ${tableName}\n`;
    if (tableInfo.columns) {
      formatted += "Columns:\n";
      for (const column of tableInfo.columns) {
        formatted += `  - ${column.name} (${column.type})${column.nullable ? " NULL" : " NOT NULL"}`;
        if (column.default) {
          formatted += ` DEFAULT ${column.default}`;
        }
        formatted += "\n";
      }
    }
  }
  
  return formatted;
}

/**
 * Get example queries for the database type
 */
function getExampleQueries(connectionType: string): string {
  const examples = {
    postgres: `
Example 1: "Show me all users created in the last week"
<query>
SELECT * FROM users
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 100;
</query>

Example 2: "Count orders by status"
<query>
SELECT status, COUNT(*) as order_count
FROM orders
GROUP BY status
ORDER BY order_count DESC;
</query>`,
    
    mysql: `
Example 1: "Show me all users created in the last week"
<query>
SELECT * FROM users
WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
ORDER BY created_at DESC
LIMIT 100;
</query>

Example 2: "Count orders by status"
<query>
SELECT status, COUNT(*) as order_count
FROM orders
GROUP BY status
ORDER BY order_count DESC;
</query>`,
    
    sqlite: `
Example 1: "Show me all users created in the last week"
<query>
SELECT * FROM users
WHERE created_at >= datetime('now', '-7 days')
ORDER BY created_at DESC
LIMIT 100;
</query>

Example 2: "Count orders by status"
<query>
SELECT status, COUNT(*) as order_count
FROM orders
GROUP BY status
ORDER BY order_count DESC;
</query>`,
  };

  const result = (examples as any)[connectionType];
  return result || examples.postgres;
}

/**
 * Parse AI response to extract query and explanation
 */
function parseAIResponse(text: string): {
  query: string;
  explanation: string;
} {
  // Try to extract query between <query> tags
  const queryMatch = text.match(/<query>([\s\S]*?)<\/query>/);
  const explanationMatch = text.match(/<explanation>([\s\S]*?)<\/explanation>/);
  
  if (queryMatch && queryMatch[1] && explanationMatch && explanationMatch[1]) {
    return {
      query: queryMatch[1].trim(),
      explanation: explanationMatch[1].trim(),
    };
  }

  // Fallback: try to find SQL query pattern
  const sqlMatch = text.match(/```sql([\s\S]*?)```/);
  if (sqlMatch && sqlMatch[1]) {
    return {
      query: sqlMatch[1].trim(),
      explanation: text.replace(sqlMatch[0], "").trim(),
    };
  }

  // Last fallback: assume the entire response is the query
  const lines = text.split("\n");
  const queryLines = [];
  const explanationLines = [];
  let isQuery = true;

  for (const line of lines) {
    if (line.trim() === "" && isQuery && queryLines.length > 0) {
      isQuery = false;
      continue;
    }
    
    if (isQuery) {
      queryLines.push(line);
    } else {
      explanationLines.push(line);
    }
  }

  return {
    query: queryLines.join("\n").trim(),
    explanation: explanationLines.join("\n").trim() || "Query generated successfully",
  };
}