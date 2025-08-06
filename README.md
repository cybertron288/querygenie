# QueryGenie - AI-Powered Database Assistant Platform

<div align="center">
  <img src="docs/assets/logo.png" alt="QueryGenie Logo" width="200" />
  
  [![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
  [![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-blue)](https://www.postgresql.org/)
  
  **Transform your database interactions with AI-powered intelligence**
  
  [Demo](https://querygenie.ai) | [Documentation](docs/product/) | [Report Bug](https://github.com/querygenie/issues) | [Request Feature](https://github.com/querygenie/issues)
</div>

---

## 🚀 Overview

QueryGenie is an enterprise-grade, AI-powered database assistant that revolutionizes how teams interact with their databases. It combines natural language processing with robust database management to make data accessible to everyone, regardless of SQL expertise.

### ✨ Key Features

- **🤖 AI Query Generation**: Generate complex SQL queries using natural language
- **🔐 Multi-Database Support**: PostgreSQL, MySQL, SQLite, and MS SQL Server
- **👥 Team Collaboration**: Role-based access control with 4 permission levels
- **📊 Visual Query Builder**: Intuitive interface for non-technical users
- **📝 Automatic Documentation**: AI-generated database documentation
- **🔍 Query History & Analytics**: Track and analyze query performance
- **🔒 Enterprise Security**: Encrypted credentials, audit logging, SSO support
- **💰 Cost-Effective**: Start free with Gemini AI, scale as needed

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Detailed Setup](#detailed-setup)
- [Configuration](#configuration)
- [Development](#development)
- [Architecture](#architecture)
- [Deployment](#deployment)
- [API Documentation](#api-documentation)
- [Contributing](#contributing)
- [Support](#support)
- [License](#license)

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18.0.0 or higher)
- **npm** (v8.0.0 or higher) or **yarn**
- **PostgreSQL** (v14 or higher) or **Docker** for containerized setup
- **Git** for version control

### Optional (Recommended)

- **Docker & Docker Compose** for local development environment
- **Redis** for caching (can use Upstash Redis for free tier)

## 🏃‍♂️ Quick Start

Get QueryGenie up and running in under 5 minutes:

```bash
# Clone the repository
git clone https://github.com/querygenie/querygenie.git
cd querygenie

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Start PostgreSQL with Docker (recommended)
npm run local:up

# Initialize and seed the database
npm run db:init
npm run db:migrate
npm run db:seed

# Start the development server
npm run dev
```

🎉 **That's it!** Visit [http://localhost:3000](http://localhost:3000) to see QueryGenie in action.

### 🔑 Default Credentials

```
Admin User:
Email: admin@querygenie.ai
Password: password123

Test Users:
- john@example.com / password123
- jane@example.com / password123
- bob@example.com / password123
```

## 🛠️ Detailed Setup

### 1. Environment Configuration

Create a `.env.local` file in the root directory:

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/querygenie"

# Authentication
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here-min-32-chars"

# Encryption
ENCRYPTION_SECRET="your-encryption-secret-min-32-chars"

# AI Services (Start with free Gemini)
GEMINI_API_KEY="your-gemini-api-key"
# Optional - Users can provide their own keys
# OPENAI_API_KEY="your-openai-api-key"
# ANTHROPIC_API_KEY="your-claude-api-key"

# OAuth (Optional)
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Email (Optional - uses console in dev)
RESEND_API_KEY="your-resend-api-key"
EMAIL_FROM="noreply@querygenie.ai"

# Redis (Optional - for production)
REDIS_URL="redis://localhost:6379"
# Or use Upstash Redis (free tier)
# UPSTASH_REDIS_REST_URL="your-upstash-url"
# UPSTASH_REDIS_REST_TOKEN="your-upstash-token"

# Storage (Optional - for production)
# Cloudflare R2 (S3 compatible)
R2_ACCOUNT_ID="your-account-id"
R2_ACCESS_KEY_ID="your-access-key"
R2_SECRET_ACCESS_KEY="your-secret-key"
R2_BUCKET_NAME="querygenie"
```

### 2. Database Setup

#### Option A: Using Docker (Recommended)

```bash
# Start PostgreSQL and Redis containers
npm run local:up

# Initialize database with extensions
npm run db:init

# Run migrations
npm run db:migrate

# Seed with sample data
npm run db:seed
```

#### Option B: Using Local PostgreSQL

1. Create a database:
```sql
CREATE DATABASE querygenie;
```

2. Update DATABASE_URL in `.env.local`

3. Run initialization:
```bash
psql $DATABASE_URL -f scripts/init-db.sql
npm run db:migrate
npm run db:seed
```

### 3. AI Configuration

#### Free Tier (Gemini)

1. Get a free API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Add to `.env.local`:
```env
GEMINI_API_KEY="your-api-key"
```

#### Premium Models (User-Provided Keys)

Users can add their own API keys for:
- **Claude (Anthropic)**: Superior SQL generation
- **GPT-4 (OpenAI)**: Advanced query optimization
- **Custom Models**: Via API integration

## 🔧 Configuration

### Database Connections

QueryGenie supports multiple database types:

```typescript
// Supported database types
type DatabaseType = "postgres" | "mysql" | "sqlite" | "mssql";

// Connection modes
type ConnectionMode = "read-only" | "read-write";
```

### Role-Based Access Control

Four permission levels:

| Role | Permissions |
|------|------------|
| **Owner** | Full access, workspace management, billing |
| **Admin** | Manage connections, users, settings |
| **Editor** | Create/edit queries, documentation |
| **Viewer** | Read-only access to queries and data |

### Security Features

- **Encrypted Credentials**: AES-256-GCM encryption for database passwords
- **Audit Logging**: Complete activity tracking for compliance
- **Session Management**: Secure JWT-based authentication
- **API Rate Limiting**: Prevent abuse with configurable limits
- **SQL Injection Protection**: Parameterized queries and validation

## 💻 Development

### Available Scripts

```bash
# Development
npm run dev           # Start development server
npm run build        # Build for production
npm run start        # Start production server

# Database
npm run db:generate  # Generate migrations from schema
npm run db:migrate   # Run pending migrations
npm run db:push      # Push schema changes (dev only)
npm run db:studio    # Open Drizzle Studio GUI
npm run db:seed      # Seed sample data
npm run db:reset     # Reset database (dev only)

# Docker
npm run local:up     # Start local services
npm run local:down   # Stop local services
npm run local:reset  # Reset all local data

# Code Quality
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
npm run typecheck    # TypeScript type checking
npm run format       # Format with Prettier
npm run test         # Run tests
npm run test:watch   # Run tests in watch mode
```

### Project Structure

```
querygenie/
├── src/
│   ├── app/                  # Next.js app router pages
│   │   ├── api/              # API routes
│   │   ├── auth/             # Authentication pages
│   │   ├── dashboard/        # Dashboard pages
│   │   └── workspaces/       # Workspace pages
│   ├── components/           # React components
│   │   ├── ui/              # Base UI components
│   │   ├── layout/          # Layout components
│   │   └── query/           # Query-specific components
│   ├── lib/                 # Core libraries
│   │   ├── db/              # Database layer
│   │   ├── auth/            # Authentication
│   │   ├── ai/              # AI integrations
│   │   └── api/             # API utilities
│   └── hooks/               # Custom React hooks
├── docs/
│   ├── product/             # Product documentation
│   └── api/                 # API documentation
├── scripts/                 # Utility scripts
├── public/                  # Static assets
└── drizzle/                # Database migrations
```

## 🏗️ Architecture

### Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: NextAuth.js 5.0
- **AI/ML**: Google Gemini, OpenAI, Anthropic Claude
- **State Management**: Zustand, React Query
- **UI Components**: Radix UI, shadcn/ui
- **Deployment**: Vercel, AWS, or self-hosted

### System Architecture

```mermaid
graph TB
    Client[Web Client] --> NextJS[Next.js App]
    NextJS --> Auth[NextAuth.js]
    NextJS --> API[API Routes]
    
    API --> DB[(PostgreSQL)]
    API --> Redis[(Redis Cache)]
    API --> AI{AI Services}
    
    AI --> Gemini[Google Gemini]
    AI --> Claude[Anthropic Claude]
    AI --> GPT[OpenAI GPT-4]
    
    API --> S3[Object Storage]
    
    Auth --> OAuth[OAuth Providers]
    Auth --> DB
```

## 🚀 Deployment

### Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/querygenie/querygenie)

1. Click the deploy button above
2. Configure environment variables
3. Deploy!

### Docker

```bash
# Build the image
docker build -t querygenie .

# Run the container
docker run -p 3000:3000 --env-file .env.local querygenie
```

### Self-Hosted

1. Build the application:
```bash
npm run build
```

2. Set production environment variables

3. Start the server:
```bash
npm run start
```

### Production Checklist

- [ ] Configure production database (Neon, Supabase, or AWS RDS)
- [ ] Set up Redis for caching (Upstash or AWS ElastiCache)
- [ ] Configure object storage (Cloudflare R2 or AWS S3)
- [ ] Set up monitoring (Sentry, DataDog)
- [ ] Configure backup strategy
- [ ] Set up CI/CD pipeline
- [ ] Configure custom domain and SSL
- [ ] Set up rate limiting and DDoS protection

## 📚 API Documentation

### REST API

All endpoints follow RESTful conventions:

```
GET    /api/workspaces              # List workspaces
POST   /api/workspaces              # Create workspace
GET    /api/workspaces/:id          # Get workspace
PATCH  /api/workspaces/:id          # Update workspace
DELETE /api/workspaces/:id          # Delete workspace

GET    /api/workspaces/:id/connections    # List connections
POST   /api/workspaces/:id/connections    # Create connection
GET    /api/connections/:id              # Get connection
PATCH  /api/connections/:id              # Update connection
DELETE /api/connections/:id              # Delete connection

POST   /api/workspaces/:id/queries        # Execute/Generate query
GET    /api/workspaces/:id/queries        # List saved queries
GET    /api/queries/:id                   # Get query details
PATCH  /api/queries/:id                   # Update query
DELETE /api/queries/:id                   # Delete query
```

### Authentication

```typescript
// Example authenticated request
const response = await fetch('/api/workspaces', {
  headers: {
    'Authorization': `Bearer ${session.accessToken}`,
    'Content-Type': 'application/json'
  }
});
```

### Rate Limiting

- **Anonymous**: 10 requests/minute
- **Authenticated**: 100 requests/minute
- **Pro Plan**: 1000 requests/minute
- **Enterprise**: Unlimited

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Use TypeScript with strict mode
- Follow ESLint and Prettier configurations
- Write tests for new features
- Update documentation

## 💬 Support

### Documentation

- [Product Documentation](docs/product/)
- [API Reference](docs/api/)
- [Architecture Guide](docs/product/TECH_STACK_DECISION_DOC.md)

### Community

- [Discord Server](https://discord.gg/querygenie)
- [GitHub Discussions](https://github.com/querygenie/discussions)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/querygenie)

### Commercial Support

- Email: support@querygenie.ai
- Enterprise: enterprise@querygenie.ai

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - The React Framework
- [Drizzle ORM](https://orm.drizzle.team/) - TypeScript ORM
- [shadcn/ui](https://ui.shadcn.com/) - UI Components
- [Radix UI](https://www.radix-ui.com/) - Primitive Components
- [Vercel](https://vercel.com/) - Deployment Platform

---

<div align="center">
  Made with ❤️ by the QueryGenie Team
  
  [Website](https://querygenie.ai) | [Twitter](https://twitter.com/querygenie) | [LinkedIn](https://linkedin.com/company/querygenie)
</div>