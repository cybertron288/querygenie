# QueryGenie Setup Guide

## 📋 Prerequisites Checklist

Before starting, ensure you have:

- [ ] Node.js v18+ installed (`node --version`)
- [ ] npm v8+ installed (`npm --version`)
- [ ] Git installed (`git --version`)
- [ ] PostgreSQL 14+ OR Docker installed
- [ ] A code editor (VS Code recommended)

## 🚀 Installation Methods

### Method 1: Automated Setup (Recommended)

```bash
# Clone and setup in one command
git clone https://github.com/querygenie/querygenie.git && \
cd querygenie && \
npm run setup
```

This will:
1. Install all dependencies
2. Start Docker containers
3. Initialize the database
4. Run migrations
5. Seed sample data

### Method 2: Step-by-Step Setup

#### Step 1: Clone the Repository

```bash
git clone https://github.com/querygenie/querygenie.git
cd querygenie
```

#### Step 2: Install Dependencies

```bash
npm install
```

#### Step 3: Configure Environment

```bash
# Copy the example environment file
cp .env.example .env.local

# Edit .env.local with your settings
# At minimum, you need:
# - DATABASE_URL
# - NEXTAUTH_SECRET
# - ENCRYPTION_SECRET
```

#### Step 4: Database Setup

**Option A: Using Docker (Easiest)**

```bash
# Start PostgreSQL and Redis
npm run local:up

# Wait for containers to be ready (about 5 seconds)
sleep 5

# Initialize database
npm run db:init
npm run db:migrate
npm run db:seed
```

**Option B: Using Existing PostgreSQL**

1. Create database:
```sql
CREATE DATABASE querygenie;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
```

2. Update DATABASE_URL in `.env.local`:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/querygenie"
```

3. Run migrations:
```bash
npm run db:migrate
npm run db:seed
```

#### Step 5: Start Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## 🔑 Getting API Keys

### Google Gemini (Free - Required)

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click "Get API Key"
3. Create a new API key
4. Add to `.env.local`:
   ```env
   GEMINI_API_KEY="your-api-key-here"
   ```

### GitHub OAuth (Optional)

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in:
   - Application name: QueryGenie Local
   - Homepage URL: http://localhost:3000
   - Callback URL: http://localhost:3000/api/auth/callback/github
4. Add to `.env.local`:
   ```env
   GITHUB_CLIENT_ID="your-client-id"
   GITHUB_CLIENT_SECRET="your-client-secret"
   ```

### Google OAuth (Optional)

1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
6. Add to `.env.local`:
   ```env
   GOOGLE_CLIENT_ID="your-client-id"
   GOOGLE_CLIENT_SECRET="your-client-secret"
   ```

## 🧪 Verify Installation

Run these commands to verify everything is working:

```bash
# Check database connection
npm run db:studio

# Run tests
npm test

# Type checking
npm run typecheck

# Lint check
npm run lint
```

## 🔧 Common Issues & Solutions

### Issue: Database Connection Failed

**Error**: `ECONNREFUSED 127.0.0.1:5432`

**Solution**:
```bash
# Ensure Docker is running
docker ps

# Restart containers
npm run local:reset
```

### Issue: Module Not Found

**Error**: `Cannot find module 'xxx'`

**Solution**:
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Issue: Port Already in Use

**Error**: `Port 3000 is already in use`

**Solution**:
```bash
# Find and kill the process
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 npm run dev
```

### Issue: Database Migrations Failed

**Error**: `Migration failed`

**Solution**:
```bash
# Reset database and try again
npm run db:reset
npm run db:migrate
npm run db:seed
```

### Issue: Authentication Not Working

**Error**: `NEXTAUTH_URL is not set`

**Solution**:
Ensure `.env.local` has:
```env
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="minimum-32-character-secret-key"
```

## 🏗️ Production Setup

### Database (Neon - Recommended)

1. Create account at [Neon](https://neon.tech)
2. Create a new project
3. Copy connection string
4. Update `.env.local`:
   ```env
   DATABASE_URL="postgresql://user:pass@xxx.neon.tech/querygenie?sslmode=require"
   ```

### Deployment (Vercel)

1. Push code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variables
4. Deploy!

### Redis Cache (Upstash)

1. Create account at [Upstash](https://upstash.com)
2. Create Redis database
3. Copy credentials
4. Update `.env.local`:
   ```env
   UPSTASH_REDIS_REST_URL="your-url"
   UPSTASH_REDIS_REST_TOKEN="your-token"
   ```

## 📊 Health Checks

After setup, verify these endpoints:

- `http://localhost:3000` - Homepage loads
- `http://localhost:3000/api/health` - API health check
- `http://localhost:3000/auth/signin` - Auth page loads

## 🆘 Getting Help

- 📖 [Documentation](../README.md)
- 💬 [Discord Community](https://discord.gg/querygenie)
- 🐛 [Report Issues](https://github.com/querygenie/issues)
- 📧 [Email Support](mailto:support@querygenie.ai)

## 📝 Next Steps

1. ✅ Login with test credentials
2. ✅ Create your first workspace
3. ✅ Add a database connection
4. ✅ Try AI query generation
5. ✅ Explore the dashboard

---

Happy coding! 🚀