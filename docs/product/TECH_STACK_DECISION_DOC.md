# 🏗️ Technical Stack Decision Document
## AI-Powered Database Assistance & Documentation Platform

### Version 1.0 | Date: 2025-01-19

---

## 📋 Executive Summary

This document outlines the comprehensive technical architecture and technology decisions for QueryGenie, an AI-powered database assistance platform. The architecture prioritizes developer experience, type safety, and scalability while maintaining cost efficiency.

### Key Technology Decisions:
- **Full-Stack Framework:** Next.js 14+ (unified frontend/backend)
- **Database:** Neon PostgreSQL (serverless) with Drizzle ORM
- **State Management:** Zustand for client state
- **AI/ML:** Gemini Free tier default, user API keys for Claude/GPT-4
- **Design System:** TailwindCSS + shadcn/ui (Linear-inspired minimal design)
- **Deployment:** Railway/Render (bootstrap) → Vercel/AWS (scale)

### Architecture Philosophy:
- **Bootstrap First:** Start free, scale when validated
- **Type Safety:** End-to-end TypeScript with Drizzle ORM
- **Developer Experience:** Minimal friction, intuitive interfaces
- **AI Flexibility:** Free tier default with user API key support
- **Progressive Enhancement:** Clear migration path to enterprise

---

## 🏛️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Client Layer                         │
│  Next.js App Router │ React Components │ Zustand │ TanStack │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTPS/WSS
┌─────────────────────────┴───────────────────────────────────┐
│                      API Gateway Layer                       │
│    Next.js API Routes │ tRPC │ NextAuth │ Rate Limiting     │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────┐
│                     Business Logic Layer                     │
│   Query Service │ Schema Service │ Docs Service │ Mock Data │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────┐
│                        Data Layer                            │
│    Neon PostgreSQL │ Drizzle ORM │ Upstash Redis │ pgvector │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────┐
│                      AI Service Layer                        │
│  Gemini Free (default) │ User Keys: Claude/GPT-4/Gemini Pro │
└──────────────────────────────────────────────────────────────┘
```

---

## 💻 Frontend Stack

### Core Framework
```typescript
// Next.js 14+ with App Router
{
  "framework": "Next.js 14.2+",
  "rendering": "Server Components + Client Components",
  "routing": "App Router with parallel routes",
  "optimization": "Automatic code splitting, ISR, Edge Runtime"
}
```

### State Management Architecture
```typescript
// Zustand for global client state
interface AppStore {
  // Workspace state
  workspace: Workspace | null;
  setWorkspace: (workspace: Workspace) => void;
  
  // Connection state
  activeConnection: Connection | null;
  connections: Connection[];
  
  // Query state
  queryHistory: Query[];
  activeQuery: string;
  
  // UI state
  sidebarOpen: boolean;
  theme: 'light' | 'dark';
}

// React Query for server state
{
  "caching": "Aggressive with stale-while-revalidate",
  "optimistic": "Updates for better UX",
  "prefetching": "Route-based prefetching"
}
```

### UI Component Library
```typescript
// TailwindCSS + shadcn/ui configuration
{
  "styling": "TailwindCSS 4",
  "components": "shadcn/ui (Radix UI primitives)",
  "theme": {
    "design": "Linear-inspired minimal aesthetic",
    "colors": "Neutral palette with accent colors",
    "spacing": "8px grid system",
    "typography": "Inter font family"
  }
}
```

### Specialized Components
- **SQL Editor:** Monaco Editor with SQL syntax highlighting
- **ERD Visualization:** React Flow with custom node types
- **Data Grids:** TanStack Table for query results
- **Charts:** Recharts for analytics dashboards
- **Forms:** React Hook Form + Zod validation

### Performance Optimizations
- Dynamic imports for heavy components
- Virtual scrolling for large datasets
- Image optimization with Next.js Image
- Font optimization with next/font
- Incremental Static Regeneration for docs

---

## 🔧 Backend Stack

### API Architecture (Next.js)
```typescript
// API Routes Structure - Simple REST Pattern
app/
├── api/
│   ├── auth/
│   │   └── [...nextauth]/route.ts // NextAuth handler
│   ├── connections/
│   │   ├── route.ts               // GET all, POST new
│   │   └── [id]/
│   │       ├── route.ts           // GET, PUT, DELETE by id
│   │       └── test/route.ts      // POST test connection
│   ├── queries/
│   │   ├── generate/route.ts     // POST AI query generation
│   │   ├── execute/route.ts      // POST Query execution
│   │   └── optimize/route.ts     // POST Query optimization
│   ├── schemas/
│   │   ├── route.ts               // GET all, POST refresh
│   │   └── [id]/erd/route.ts     // GET ERD data
│   └── webhooks/
│       └── stripe/route.ts       // Payment webhooks
```

### Type-Safe API with Zod Validation
```typescript
// app/api/queries/generate/route.ts
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

// Request validation schema
const generateQuerySchema = z.object({
  prompt: z.string().min(1).max(1000),
  connectionId: z.string().uuid(),
  model: z.enum(['gemini', 'claude', 'gpt4']).optional().default('gemini')
});

// Type inference from schema
type GenerateQueryRequest = z.infer<typeof generateQuerySchema>;

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Parse and validate request
    const body = await req.json();
    const { prompt, connectionId, model } = generateQuerySchema.parse(body);
    
    // Business logic
    const schema = await getSchemaContext(connectionId);
    const sql = await generateSQL(prompt, schema, model);
    
    // Type-safe response
    return NextResponse.json({ 
      sql,
      model,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Shared Types for Frontend/Backend
```typescript
// types/api.ts - Shared between client and server
export interface QueryGenerateRequest {
  prompt: string;
  connectionId: string;
  model?: 'gemini' | 'claude' | 'gpt4';
}

export interface QueryGenerateResponse {
  sql: string;
  model: string;
  timestamp: string;
}

// lib/api-client.ts - Type-safe API client
class APIClient {
  private async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`/api/${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    
    if (!res.ok) {
      throw new Error(`API Error: ${res.status}`);
    }
    
    return res.json();
  }
  
  async generateQuery(data: QueryGenerateRequest): Promise<QueryGenerateResponse> {
    return this.fetch<QueryGenerateResponse>('queries/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const api = new APIClient();
```

### Server Actions Alternative (Next.js 14+)
```typescript
// app/actions/queries.ts - Direct database access, no API needed
'use server';

import { z } from 'zod';
import { auth } from '@/auth';
import { db } from '@/db';

const generateQuerySchema = z.object({
  prompt: z.string().min(1).max(1000),
  connectionId: z.string().uuid(),
});

export async function generateQuery(input: unknown) {
  // Auth check
  const session = await auth();
  if (!session) {
    throw new Error('Unauthorized');
  }
  
  // Validate input
  const { prompt, connectionId } = generateQuerySchema.parse(input);
  
  // Direct database access
  const connection = await db.query.connections.findFirst({
    where: eq(connections.id, connectionId),
  });
  
  if (!connection) {
    throw new Error('Connection not found');
  }
  
  // Generate SQL
  const sql = await generateSQL(prompt, connection.schema);
  
  // Save to history
  await db.insert(queries).values({
    workspaceId: session.workspaceId,
    connectionId,
    prompt,
    sql,
    createdBy: session.userId,
  });
  
  return { sql, timestamp: new Date() };
}

// In your component (Client or Server Component)
import { generateQuery } from '@/app/actions/queries';

function QueryBuilder() {
  async function handleSubmit(formData: FormData) {
    const result = await generateQuery({
      prompt: formData.get('prompt'),
      connectionId: formData.get('connectionId'),
    });
    // Use result.sql
  }
  
  return (
    <form action={handleSubmit}>
      {/* Form fields */}
    </form>
  );
}
```

### Database Operations (Drizzle ORM)
```typescript
// Drizzle Schema Definition
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  name: varchar('name', { length: 255 }),
  role: pgEnum('role', ['admin', 'developer', 'analyst'])('role'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const connections = pgTable('connections', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id),
  name: varchar('name', { length: 255 }).notNull(),
  type: pgEnum('type', ['postgres', 'mysql', 'mssql'])('type'),
  credentials: jsonb('credentials'), // Encrypted
  mode: pgEnum('mode', ['read-only', 'read-write'])('mode'),
  createdAt: timestamp('created_at').defaultNow()
});

// Type-safe queries
const userConnections = await db
  .select()
  .from(connections)
  .where(eq(connections.workspaceId, workspaceId));
```

### Background Jobs (BullMQ)
```typescript
// Job Queue Configuration
export const queues = {
  schemaIngestion: new Queue('schema-ingestion'),
  docGeneration: new Queue('doc-generation'),
  mockDataGeneration: new Queue('mock-data'),
  queryExecution: new Queue('query-execution')
};

// Worker implementation
new Worker('schema-ingestion', async (job) => {
  const { connectionId } = job.data;
  // Ingest schema, create embeddings
  await ingestDatabaseSchema(connectionId);
  await generateSchemaEmbeddings(connectionId);
});
```

---

## 🗄️ Database Architecture

### Neon PostgreSQL (Serverless)
```typescript
// Neon Configuration - Free Tier
const neonConfig = {
  connectionString: process.env.DATABASE_URL, // Neon provides this
  ssl: { rejectUnauthorized: false },
  // Free tier limits:
  storage: '3GB',
  computeHours: 'Always available',
  branches: 10, // Great for dev/staging/prod
};

// Neon supports pgvector out of the box
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

### Migration Path to AWS RDS
```bash
# Export from Neon (when ready to scale)
pg_dump $NEON_DATABASE_URL > backup.sql

# Import to RDS
psql $RDS_DATABASE_URL < backup.sql

# Update connection string - that's it!
```

### Drizzle Configuration for Neon
```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema/*',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: true // Required for Neon
  },
  migrations: {
    table: 'migrations',
    schema: 'public'
  },
  // Neon-specific optimizations
  verbose: true,
  strict: true
});
```

### Vector Storage (pgvector)
```sql
-- Schema embeddings table
CREATE TABLE schema_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_id UUID REFERENCES schemas(id),
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Vector similarity search index
CREATE INDEX ON schema_embeddings 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

### Upstash Redis (Serverless Caching)
```typescript
// Upstash Configuration - Free Tier
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL,
  token: process.env.UPSTASH_REDIS_TOKEN,
});

// Free tier: 10,000 commands/day
const cacheConfig = {
  // AI responses cache (15 min)
  aiResponses: {
    ttl: 900,
    prefix: 'ai:response:'
  },
  // Schema cache (1 hour) 
  schemas: {
    ttl: 3600,
    prefix: 'schema:'
  },
  // Query results cache (5 min)
  queryResults: {
    ttl: 300,
    prefix: 'query:result:'
  }
};

// Migration to ElastiCache: Just change connection
// Upstash is Redis-compatible, zero code changes needed
```

---

## 🤖 AI/ML Infrastructure

### Bootstrap-First AI Architecture
```typescript
// Start with FREE Gemini, scale with user API keys
interface AIProvider {
  generateSQL(prompt: string, context: SchemaContext): Promise<string>;
  explainQuery(sql: string): Promise<string>;
  optimizeQuery(sql: string, schema: Schema): Promise<OptimizationResult>;
  generateDocs(schema: Schema): Promise<Documentation>;
}

// User API Key Management
interface UserAPIKeys {
  openai?: string;      // User's OpenAI key
  anthropic?: string;   // User's Claude key  
  gemini_pro?: string;  // User's Gemini Pro key (paid tier)
}

// Smart Model Router with User Keys
class AIModelRouter {
  async getProvider(userId: string, task: AITask): Promise<AIProvider> {
    const userKeys = await this.getUserKeys(userId);
    
    // Priority: User's premium keys > Free Gemini
    if (task.complexity === 'high' && userKeys.anthropic) {
      return new ClaudeProvider(userKeys.anthropic);
    }
    
    if (userKeys.openai) {
      return new OpenAIProvider(userKeys.openai);
    }
    
    if (userKeys.gemini_pro) {
      return new GeminiProvider(userKeys.gemini_pro, 'pro');
    }
    
    // Default: FREE Gemini Flash
    return new GeminiProvider(process.env.GEMINI_FREE_KEY, 'flash');
  }
}
```

### Gemini Free Tier (Default Provider)
```typescript
// Gemini Flash - FREE Forever
const geminiFreeConfig = {
  model: 'gemini-1.5-flash',
  apiKey: process.env.GEMINI_FREE_KEY,
  limits: {
    requestsPerMinute: 60,
    tokensPerMinute: 1_000_000,
    freeForever: true
  },
  generationConfig: {
    temperature: 0.2,  // Lower for SQL accuracy
    maxOutputTokens: 2048,
    topK: 1,
    topP: 0.8
  }
};

// Usage for all queries by default
async function generateSQL(prompt: string, schema: Schema) {
  const model = genAI.getGenerativeModel({ 
    model: geminiFreeConfig.model 
  });
  
  const result = await model.generateContent(
    buildPromptWithSchema(prompt, schema)
  );
  
  return parseSQL(result.response.text());
}
```

### User-Provided Claude Integration
```typescript
// Claude 3 - Only with user's API key
class ClaudeProvider implements AIProvider {
  constructor(private userApiKey: string) {
    this.client = new Anthropic({ 
      apiKey: userApiKey // User's own key
    });
  }
  
  async generateSQL(prompt: string, context: SchemaContext) {
    try {
      const response = await this.client.messages.create({
        model: 'claude-3-sonnet-20240229', // or opus based on user's plan
        messages: [{
          role: 'user',
          content: this.buildPrompt(prompt, context)
        }],
        max_tokens: 4096,
        temperature: 0.2
      });
      return this.parseSQL(response.content);
    } catch (error) {
      // Fallback to free Gemini if user's key fails
      return this.fallbackToGemini(prompt, context);
    }
  }
}
```

### User-Provided OpenAI Integration
```typescript
// GPT-4 - Only with user's API key
class OpenAIProvider implements AIProvider {
  constructor(private userApiKey: string) {
    this.client = new OpenAI({ 
      apiKey: userApiKey // User's own key
    });
  }
  
  async generateSQL(prompt: string, context: SchemaContext) {
    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [{ 
          role: 'system',
          content: 'You are a SQL expert. Generate optimized queries.'
        }, {
          role: 'user', 
          content: this.buildPrompt(prompt, context)
        }],
        temperature: 0.2
      });
      return this.parseSQL(response.choices[0].message.content);
    } catch (error) {
      // Fallback to free Gemini if user's key fails
      return this.fallbackToGemini(prompt, context);
    }
  }
}
```

### API Key Management System
```typescript
// Secure storage of user API keys
const apiKeySchema = pgTable('user_api_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  provider: pgEnum('provider', ['openai', 'anthropic', 'gemini_pro'])('provider'),
  encryptedKey: text('encrypted_key').notNull(), // AES-256 encrypted
  isActive: boolean('is_active').default(true),
  lastUsed: timestamp('last_used'),
  createdAt: timestamp('created_at').defaultNow()
});

// API Key validation and usage tracking
class APIKeyManager {
  async validateAndTrack(userId: string, provider: string) {
    const key = await this.getUserKey(userId, provider);
    if (!key) return null;
    
    // Update last used
    await db.update(apiKeySchema)
      .set({ lastUsed: new Date() })
      .where(eq(apiKeySchema.id, key.id));
    
    return this.decrypt(key.encryptedKey);
  }
  
  async storeUserKey(userId: string, provider: string, apiKey: string) {
    // Validate key first
    const isValid = await this.validateAPIKey(provider, apiKey);
    if (!isValid) throw new Error('Invalid API key');
    
    // Encrypt and store
    const encrypted = await this.encrypt(apiKey);
    await db.insert(apiKeySchema).values({
      userId,
      provider,
      encryptedKey: encrypted
    });
  }
}
```

### RAG Pipeline
```typescript
// Retrieval-Augmented Generation
class RAGPipeline {
  async enhance(prompt: string, connectionId: string) {
    // 1. Generate embedding for prompt
    const promptEmbedding = await this.generateEmbedding(prompt);
    
    // 2. Retrieve relevant schema context
    const relevantSchemas = await this.vectorSearch(
      promptEmbedding,
      connectionId,
      limit: 5
    );
    
    // 3. Retrieve historical queries
    const similarQueries = await this.findSimilarQueries(
      promptEmbedding,
      connectionId
    );
    
    // 4. Build enhanced context
    return {
      schemas: relevantSchemas,
      examples: similarQueries,
      glossary: await this.getGlossaryTerms(relevantSchemas)
    };
  }
}
```

---

## 🔐 Security Architecture

### Authentication (NextAuth.js)
```typescript
// NextAuth Configuration
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // Validate with bcrypt
        const user = await validateUser(credentials);
        return user;
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.workspaceId = user.workspaceId;
      }
      return token;
    }
  }
};
```

### Secrets Management
```typescript
// Vault Integration
class SecretsManager {
  private vault: Vault;
  
  async storeConnectionCredentials(connectionId: string, credentials: any) {
    const encrypted = await this.encrypt(credentials);
    await this.vault.write(`database/connections/${connectionId}`, {
      data: encrypted,
      metadata: {
        createdAt: new Date().toISOString(),
        rotation: '90d'
      }
    });
  }
  
  async getConnectionCredentials(connectionId: string) {
    const secret = await this.vault.read(`database/connections/${connectionId}`);
    return this.decrypt(secret.data);
  }
}
```

### Row-Level Security
```sql
-- Enable RLS on sensitive tables
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE queries ENABLE ROW LEVEL SECURITY;

-- Policy for connections
CREATE POLICY connection_access ON connections
  FOR ALL
  USING (workspace_id IN (
    SELECT workspace_id FROM memberships 
    WHERE user_id = current_user_id()
  ));

-- Policy for queries
CREATE POLICY query_access ON queries
  FOR ALL
  USING (workspace_id IN (
    SELECT workspace_id FROM memberships 
    WHERE user_id = current_user_id()
  ));
```

---

## 🚀 DevOps & Infrastructure

### Bootstrap Hosting Options

#### Option 1: Railway (Recommended for MVP)
```yaml
# railway.toml
[build]
  builder = "nixpacks"
  buildCommand = "npm run build"

[deploy]
  startCommand = "npm start"
  restartPolicyType = "on-failure"
  restartPolicyMaxRetries = 10

# Automatic provisioning:
# - Next.js app deployment
# - Neon PostgreSQL (free)
# - Upstash Redis (free)
# Cost: $0-5/month with free credits
```

#### Option 2: Render
```yaml
# render.yaml
services:
  - type: web
    name: querygenie
    runtime: node
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: querygenie-db
          property: connectionString

databases:
  - name: querygenie-db
    plan: free # PostgreSQL free for 90 days
```

#### Option 3: Fly.io
```toml
# fly.toml
app = "querygenie"
primary_region = "iad"

[build]
  builder = "heroku/buildpacks:20"

[env]
  PORT = "8080"

[experimental]
  auto_rollback = true

[[services]]
  http_checks = []
  internal_port = 8080
  protocol = "tcp"
```

#### Option 4: Self-Hosted VPS
```bash
# Deploy with Coolify (free PaaS) on Hetzner/DigitalOcean
# Cost: $4-5/month for VPS

# 1. Install Coolify on VPS
curl -fsSL https://get.coolify.io | bash

# 2. Deploy via Git push
git remote add coolify ssh://coolify@your-server.com:22/querygenie.git
git push coolify main
```

### Docker Compose for Local Development
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NEON_DATABASE_URL=${NEON_DATABASE_URL}
      - UPSTASH_REDIS_URL=${UPSTASH_REDIS_URL}
      - UPSTASH_REDIS_TOKEN=${UPSTASH_REDIS_TOKEN}
    # Using cloud services, no local DB needed for bootstrap
```

### CI/CD Pipeline (GitHub Actions)
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test
      - run: npm run lint
      - run: npm run type-check
  
  # Deploy to Railway (Bootstrap)
  deploy-railway:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: bervProject/railway-deploy@main
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: querygenie
  
  # Alternative: Deploy to Render
  # deploy-render:
  #   needs: test
  #   runs-on: ubuntu-latest
  #   steps:
  #     - uses: johnbeynon/render-deploy-action@v0.0.8
  #       with:
  #         service-id: ${{ secrets.RENDER_SERVICE_ID }}
  #         api-key: ${{ secrets.RENDER_API_KEY }}
```

### Storage Layer (Cloudflare R2)
```typescript
// Cloudflare R2 - S3 Compatible, Zero Egress Fees
import { S3Client } from '@aws-sdk/client-s3';

const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// Free tier: 10GB storage, 1M requests/month
// Migration to S3: Just change endpoint URL
// Zero code changes needed!

export const uploadFile = async (key: string, body: Buffer) => {
  // Works with both R2 and S3
  return r2Client.send(new PutObjectCommand({
    Bucket: process.env.BUCKET_NAME,
    Key: key,
    Body: body
  }));
};
```

### Monitoring Stack
```typescript
// Sentry Configuration
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay()
  ],
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0
});

// Custom metrics with Prometheus
const promClient = require('prom-client');
const register = new promClient.Registry();

// Query execution metrics
const queryDuration = new promClient.Histogram({
  name: 'query_execution_duration_seconds',
  help: 'Duration of SQL query execution',
  labelNames: ['database_type', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});

// AI model usage metrics
const aiModelCalls = new promClient.Counter({
  name: 'ai_model_calls_total',
  help: 'Total number of AI model API calls',
  labelNames: ['model', 'task_type', 'status']
});
```

---

## 📊 Performance Optimization

### Caching Strategy
```typescript
// Multi-layer caching
class CacheManager {
  private layers = {
    memory: new LRUCache({ max: 500 }), // In-memory
    redis: new Redis(),                  // Distributed
    cdn: new CloudflareKV()             // Edge
  };
  
  async get(key: string): Promise<any> {
    // Check memory first
    if (this.layers.memory.has(key)) {
      return this.layers.memory.get(key);
    }
    
    // Check Redis
    const redisValue = await this.layers.redis.get(key);
    if (redisValue) {
      this.layers.memory.set(key, redisValue);
      return redisValue;
    }
    
    // Check CDN
    const cdnValue = await this.layers.cdn.get(key);
    if (cdnValue) {
      await this.layers.redis.set(key, cdnValue, 'EX', 300);
      this.layers.memory.set(key, cdnValue);
      return cdnValue;
    }
    
    return null;
  }
}
```

### Database Optimization
```typescript
// Connection pooling
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                    // Maximum connections
  idleTimeoutMillis: 30000,   // Close idle connections
  connectionTimeoutMillis: 2000
});

// Query optimization
class QueryOptimizer {
  async analyzeAndOptimize(sql: string) {
    // Get execution plan
    const plan = await db.execute(`EXPLAIN ANALYZE ${sql}`);
    
    // Analyze for common issues
    const issues = this.detectIssues(plan);
    
    // Suggest optimizations
    return {
      original: sql,
      optimized: this.applySuggestions(sql, issues),
      suggestions: issues.map(i => i.suggestion),
      estimatedImprovement: this.calculateImprovement(plan)
    };
  }
}
```

### Frontend Performance
```typescript
// Code splitting
const SQLEditor = dynamic(() => import('@/components/SQLEditor'), {
  loading: () => <EditorSkeleton />,
  ssr: false
});

const ERDViewer = dynamic(() => import('@/components/ERDViewer'), {
  loading: () => <ERDSkeleton />,
  ssr: false
});

// Virtual scrolling for large datasets
<VirtualTable
  data={queryResults}
  rowHeight={40}
  overscan={5}
  renderRow={({ index, style }) => (
    <div style={style}>
      <TableRow data={queryResults[index]} />
    </div>
  )}
/>

// Image optimization
<Image
  src={schemaPreview}
  alt="Schema ERD"
  width={1200}
  height={800}
  priority={false}
  loading="lazy"
  placeholder="blur"
/>
```

---

## 💰 Cost Analysis

### Phase 1: Bootstrap (FREE - $0/month)
| Service | Provider | Cost |
|---------|----------|------|
| **Hosting** | Railway free credits | $0 |
| **Database** | Neon free tier (3GB) | $0 |
| **Redis Cache** | Upstash free (10k req/day) | $0 |
| **File Storage** | Cloudflare R2 (10GB) | $0 |
| **AI Model** | Gemini Flash (free) | $0 |
| **Monitoring** | Sentry free tier | $0 |
| **Total** | | **$0** |

### Phase 2: Early Growth ($20-50/month)
| Service | Provider | Cost |
|---------|----------|------|
| **Hosting** | Railway Hobby | $5-20 |
| **Database** | Neon Pro (10GB) | $19 |
| **Redis Cache** | Upstash pay-as-you-go | $0-10 |
| **File Storage** | R2 pay-as-you-go | $0-5 |
| **AI Model** | User API keys | $0 |
| **Total** | | **$24-54** |

### Phase 3: Scale (When Ready)
| Service | Migration Path | Est. Cost |
|---------|---------------|--------|
| **Hosting** | Railway → Vercel/AWS | $100+ |
| **Database** | Neon → AWS RDS | $150+ |
| **Redis** | Upstash → ElastiCache | $25+ |
| **Storage** | R2 → S3 (optional) | Same |
| **AI** | Managed keys + usage | $500+ |
| **Total** | | **$775+** |

### AI Cost Comparison
| Model | Free Tier | With User Keys | Managed (Scale) |
|-------|-----------|----------------|---------------|
| **Gemini Flash** | ✅ Unlimited | N/A | N/A |
| **Gemini Pro** | ❌ | User pays | $0.35/1K tokens |
| **GPT-4** | ❌ | User pays | $10/1K tokens |
| **Claude 3** | ❌ | User pays | $15/1K tokens |

### Bootstrap Cost Optimization
1. **Start with Gemini Free**: No AI costs initially
2. **User API Keys**: Let power users bring their own keys
3. **Serverless Everything**: Pay only for usage
4. **No CDN Initially**: Cloudflare free tier sufficient
5. **Smart Caching**: Maximize free tier limits

---

## 🗓️ Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4)
- [ ] Next.js project setup with TypeScript
- [ ] PostgreSQL + Drizzle ORM schema
- [ ] Authentication with NextAuth.js
- [ ] Basic UI with TailwindCSS + shadcn/ui
- [ ] Zustand store configuration

### Phase 2: Core Features (Weeks 5-8)
- [ ] Database connection management
- [ ] Schema ingestion and ERD visualization
- [ ] Basic AI query generation (GPT-4)
- [ ] Query execution sandbox
- [ ] Simple documentation generation

### Phase 3: AI Enhancement (Weeks 9-12)
- [ ] Multi-model integration (Claude, Gemini)
- [ ] RAG pipeline with embeddings
- [ ] Query optimization suggestions
- [ ] Advanced mock data generation
- [ ] Collaborative workspaces

### Phase 4: Enterprise Features (Weeks 13-16)
- [ ] Advanced RBAC
- [ ] Audit logging
- [ ] Git integration
- [ ] Performance monitoring
- [ ] Billing integration

### Phase 5: Scale & Polish (Weeks 17-20)
- [ ] Performance optimization
- [ ] Security hardening
- [ ] Documentation & tutorials
- [ ] Beta testing
- [ ] Production deployment

---

## 🎯 Technical Decision Rationale

### Why Next.js for Full-Stack?
- **Unified Codebase**: Single repository, shared types
- **Server Components**: Optimal performance with SSR
- **API Routes**: Built-in backend without separate service
- **Edge Runtime**: Global deployment capabilities
- **Developer Experience**: Hot reload, TypeScript support

### Why PostgreSQL + Drizzle?
- **PostgreSQL**: Mature, reliable, pgvector for embeddings
- **Drizzle ORM**: Type-safe, lightweight, excellent DX
- **Migrations**: Version-controlled schema changes
- **Performance**: Optimized queries with proper indexing

### Why Zustand for State?
- **Simplicity**: Minimal boilerplate vs Redux
- **TypeScript**: Excellent type inference
- **Performance**: Efficient re-renders
- **DevTools**: Time-travel debugging
- **Size**: Only 3KB gzipped

### Why Multi-Model AI?
- **Claude**: Superior for complex reasoning and SQL
- **GPT-4**: Balanced performance for general tasks
- **Gemini**: Multimodal capabilities for ERD analysis
- **Cost Optimization**: Route by task complexity
- **Redundancy**: Fallback if one service is down

---

## 🚨 Risk Mitigation

### Technical Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| AI hallucinations | High | Schema validation, query preview |
| Database security | Critical | Read-only default, query sandboxing |
| Performance at scale | Medium | Caching, queue management, CDN |
| Vendor lock-in | Medium | Abstraction layers, standard protocols |
| Data privacy | High | Schema-only ingestion, encryption |

### Contingency Plans
1. **AI Service Outage**: Fallback to alternative models
2. **Database Overload**: Read replicas, connection pooling
3. **Security Breach**: Automated secret rotation, audit logs
4. **Cost Overrun**: Usage-based throttling, tier limits

---

## 📝 Conclusion

This technical stack provides a robust, scalable foundation for an AI-powered database assistance platform. The architecture prioritizes:

- **Developer Experience**: Type-safe, modern tooling
- **Performance**: Optimized at every layer
- **Security**: Defense in depth approach
- **Scalability**: Horizontal scaling ready
- **Cost Efficiency**: Smart resource utilization

The chosen technologies work synergistically to deliver a platform that matches the sophistication of Linear's UX with the AI capabilities of modern database assistance tools.

---

## 🏠 Local Development Setup

### Quick Start (5 minutes)

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/querygenie.git
cd querygenie

# 2. Copy environment template
cp .env.example .env.local

# 3. Install dependencies
npm install

# 4. Start local PostgreSQL with pgvector
docker-compose up -d

# 5. Run database migrations
npm run db:migrate

# 6. Seed sample data (optional)
npm run db:seed

# 7. Start development server
npm run dev

# 🎉 Open http://localhost:3000
```

### Simple Environment Configuration

```bash
# .env.local - Just 6 essential variables for local dev

# Database (local PostgreSQL from Docker)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/querygenie"

# Authentication (use any random string for local)
NEXTAUTH_SECRET="local-dev-secret-change-in-production"
NEXTAUTH_URL="http://localhost:3000"

# AI Configuration (start with free Gemini)
GEMINI_API_KEY="your-free-gemini-key-here"

# Optional: OAuth (can skip for local dev)
GOOGLE_CLIENT_ID="optional-for-local"
GOOGLE_CLIENT_SECRET="optional-for-local"
```

### Docker Compose for Local Services

```yaml
# docker-compose.yml - Everything you need locally
version: '3.8'

services:
  postgres:
    image: pgvector/pgvector:pg16
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: querygenie
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  # Optional: Local Redis (if you want to test caching)
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  # Optional: Drizzle Studio for database GUI
  drizzle-studio:
    image: node:20-alpine
    working_dir: /app
    volumes:
      - .:/app
    command: npx drizzle-kit studio --host 0.0.0.0
    ports:
      - "4983:4983"
    depends_on:
      - postgres

volumes:
  postgres_data:
  redis_data:
```

### Local Development Scripts

```json
// package.json scripts
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    
    // Database management
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "db:seed": "tsx scripts/seed.ts",
    "db:reset": "tsx scripts/reset.ts && npm run db:migrate && npm run db:seed",
    
    // Local services
    "local:up": "docker-compose up -d",
    "local:down": "docker-compose down",
    "local:reset": "docker-compose down -v && docker-compose up -d",
    
    // Development helpers
    "type-check": "tsc --noEmit",
    "lint": "next lint",
    "format": "prettier --write .",
    
    // One command to rule them all
    "setup": "npm install && npm run local:up && sleep 5 && npm run db:migrate && npm run dev"
  }
}
```

### Environment Validation

```typescript
// lib/env.ts - Validate environment on startup
import { z } from 'zod';

const envSchema = z.object({
  // Required for all environments
  DATABASE_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(1),
  NEXTAUTH_URL: z.string().url(),
  
  // Required for production, optional for dev
  GEMINI_API_KEY: z.string().optional(),
  
  // Optional OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  
  // Feature flags
  ENABLE_MOCK_AI: z.boolean().default(false),
  ENABLE_DEBUG_MODE: z.boolean().default(true),
});

// Validate on startup
export const env = envSchema.parse({
  ...process.env,
  ENABLE_MOCK_AI: process.env.NODE_ENV === 'development',
  ENABLE_DEBUG_MODE: process.env.NODE_ENV === 'development',
});
```

### Local Service Alternatives

```typescript
// lib/services.ts - Switch between local and cloud services

import { env } from '@/lib/env';

// Database: Local PostgreSQL for dev, Neon for prod
export const getDatabaseUrl = () => {
  return env.DATABASE_URL; // Works for both local and Neon
};

// Cache: In-memory for dev, Upstash for prod
export const getCache = () => {
  if (env.NODE_ENV === 'development') {
    // Simple in-memory cache for local dev
    return new Map();
  }
  // Upstash for production
  return new Redis({
    url: env.UPSTASH_REDIS_URL,
    token: env.UPSTASH_REDIS_TOKEN,
  });
};

// Storage: Local filesystem for dev, R2 for prod
export const getStorage = () => {
  if (env.NODE_ENV === 'development') {
    return {
      upload: async (key: string, data: Buffer) => {
        // Save to public/uploads locally
        const path = `./public/uploads/${key}`;
        await fs.writeFile(path, data);
        return { url: `/uploads/${key}` };
      },
    };
  }
  // Cloudflare R2 for production
  return new R2Client(env.R2_CONFIG);
};

// AI: Mock responses for dev (optional)
export const getAIProvider = () => {
  if (env.ENABLE_MOCK_AI) {
    return {
      generateSQL: async (prompt: string) => {
        // Return mock SQL for testing
        return `-- Mock SQL for: ${prompt}\nSELECT * FROM users LIMIT 10;`;
      },
    };
  }
  // Real AI provider
  return new GeminiProvider(env.GEMINI_API_KEY);
};
```

### Development Database Setup

```sql
-- scripts/init.sql - Initial setup for local PostgreSQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Create test user for development
CREATE USER developer WITH PASSWORD 'developer';
GRANT ALL PRIVILEGES ON DATABASE querygenie TO developer;
```

### Troubleshooting Guide

```markdown
## Common Issues & Solutions

### 1. Port Already in Use
```bash
# Error: Port 5432 already in use
# Solution: Stop existing PostgreSQL or change port
docker-compose down
sudo lsof -i :5432  # Find what's using the port
# Or use different port in docker-compose.yml
```

### 2. Database Connection Failed
```bash
# Check if PostgreSQL is running
docker ps
docker-compose logs postgres

# Reset database
npm run local:reset
```

### 3. Environment Variables Not Loading
```bash
# Make sure .env.local exists
ls -la .env*

# Check Next.js is reading env vars
console.log(process.env.DATABASE_URL);
```

### 4. Migrations Failed
```bash
# Reset and retry
npm run db:reset
npm run db:migrate
```
```

### VS Code Settings (Optional)

```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "files.associations": {
    "*.css": "tailwindcss"
  },
  // Auto-start services
  "emeraldwalk.runonsave": {
    "commands": [
      {
        "match": "\\.env\\.local$",
        "cmd": "npm run type-check"
      }
    ]
  }
}

// .vscode/launch.json - Debug configuration
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "skipFiles": ["<node_internals>/**"],
      "env": {
        "NODE_ENV": "development"
      }
    }
  ]
}
```

---

## 🚀 Bootstrap to Scale Strategy

### When to Scale Each Component

#### Hosting (Railway → Vercel/AWS)
**Scale When:**
- Daily active users > 1,000
- Need global edge deployment
- Require advanced caching strategies
- Monthly hosting costs exceed $50

**Migration Steps:**
```bash
# 1. Export environment variables
railway variables export > .env.production

# 2. Deploy to Vercel
vercel --prod

# 3. Update DNS records
# 4. Monitor for 24 hours
# 5. Sunset Railway deployment
```

#### Database (Neon → AWS RDS)
**Scale When:**
- Database size > 10GB
- Need read replicas
- Require point-in-time recovery
- Connection pooling limitations

**Migration Steps:**
```bash
# 1. Create RDS instance with same Postgres version
# 2. Export from Neon
pg_dump $NEON_DATABASE_URL --no-owner > backup.sql

# 3. Import to RDS
psql $RDS_DATABASE_URL < backup.sql

# 4. Update connection string in app
# 5. Test thoroughly before switching
```

#### Cache (Upstash → ElastiCache)
**Scale When:**
- Exceeding 10,000 commands/day
- Need persistent connections
- Require complex Redis operations
- Latency becomes critical

**Migration:**
- Upstash is Redis-compatible
- Simply update connection URL
- No code changes required

#### Storage (R2 → S3)
**Scale When:**
- Actually, you might never need to!
- R2 has no egress fees (huge savings)
- Only if you need S3-specific features

**Migration:**
```typescript
// Just change the endpoint
const client = new S3Client({
  endpoint: process.env.STORAGE_ENDPOINT,
  // R2_ENDPOINT → S3_ENDPOINT
});
```

### Progressive Enhancement Path

```mermaid
graph LR
    A[Bootstrap $0] --> B[Early Users $20-50]
    B --> C[Growth $100-300]
    C --> D[Scale $500+]
    
    A --> A1[Railway Free]
    A --> A2[Neon Free]
    A --> A3[Gemini Free]
    
    B --> B1[Railway Hobby]
    B --> B2[Neon Pro]
    B --> B3[User API Keys]
    
    C --> C1[Vercel Pro]
    C --> C2[Neon Teams]
    C --> C3[Mixed AI Models]
    
    D --> D1[AWS/Vercel Enterprise]
    D --> D2[RDS with Replicas]
    D --> D3[Managed AI Keys]
```

### Validation Milestones

| Stage | Users | Revenue | Action |
|-------|-------|---------|--------|
| **MVP** | 0-100 | $0 | Stay on free tier |
| **Product-Market Fit** | 100-500 | $500-2,500 | Upgrade hosting only |
| **Growth** | 500-2,000 | $2,500-10,000 | Scale database |
| **Scale** | 2,000+ | $10,000+ | Full infrastructure |

### Cost Control Tips

1. **Monitor Usage Daily**
   ```typescript
   // Track API usage
   const trackUsage = async (userId: string, model: string) => {
     await redis.incr(`usage:${userId}:${model}:${today}`);
     const count = await redis.get(`usage:${userId}:${model}:${today}`);
     
     if (count > FREE_TIER_LIMIT) {
       return { requiresUpgrade: true };
     }
   };
   ```

2. **Implement Smart Caching**
   ```typescript
   // Cache expensive operations
   const getCachedOrGenerate = async (key: string, generator: Function) => {
     const cached = await redis.get(key);
     if (cached) return cached;
     
     const result = await generator();
     await redis.set(key, result, 'EX', 900); // 15 min
     return result;
   };
   ```

3. **Use Feature Flags**
   ```typescript
   // Gradually roll out expensive features
   const features = {
     advancedAI: process.env.ENABLE_ADVANCED_AI === 'true',
     pdfExport: process.env.ENABLE_PDF_EXPORT === 'true',
     realtimeCollab: process.env.ENABLE_REALTIME === 'true'
   };
   ```

### Emergency Scaling Playbook

**If you get sudden traffic:**

1. **Immediate (< 1 hour):**
   - Enable Cloudflare DDoS protection (free)
   - Increase cache TTLs
   - Disable expensive features

2. **Short-term (< 24 hours):**
   - Upgrade Railway/Render tier
   - Enable Upstash paid tier
   - Implement rate limiting

3. **Long-term (< 1 week):**
   - Migrate to Vercel
   - Setup database read replicas
   - Implement queue system

---

## 📚 Appendix

### A. Code Examples
- [Next.js API Route Example](./examples/api-route.ts)
- [Drizzle Schema Definition](./examples/schema.ts)
- [Zustand Store Setup](./examples/store.ts)
- [AI Model Integration](./examples/ai-service.ts)

### B. Configuration Files
- [next.config.js](./config/next.config.js)
- [drizzle.config.ts](./config/drizzle.config.ts)
- [tailwind.config.js](./config/tailwind.config.js)
- [docker-compose.yml](./config/docker-compose.yml)

### C. References
- [Next.js Documentation](https://nextjs.org/docs)
- [Drizzle ORM Guide](https://orm.drizzle.team)
- [Zustand Documentation](https://zustand-demo.pmnd.rs)
- [Claude API Reference](https://docs.anthropic.com)
- [Linear Design System](https://linear.app/docs/design)

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-19  
**Next Review:** Q2 2025