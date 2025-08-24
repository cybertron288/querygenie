# Neon Database Setup Guide

## Prerequisites
- Neon database created with connection string in `.env.local`
- Node.js and pnpm installed
- Docker installed (for local Redis if needed)

## Step-by-Step Setup

### 1. Verify Connection String
Ensure your `.env.local` has the Neon connection string:
```bash
DATABASE_URL="postgresql://username:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require"
```

### 2. Install Dependencies
```bash
pnpm install
```

### 3. Initialize Database Schema
Push the schema to create all tables in Neon:
```bash
npm run db:push
```

Or generate and apply migrations (recommended for production):
```bash
npm run db:generate
npm run db:migrate
```

### 4. Seed Initial Data
Populate with test users and sample data:
```bash
npm run db:seed
```

This creates:
- Admin user: `admin@querygenie.ai` / `password123`
- Test users: `john@example.com`, `jane@example.com`, `bob@example.com` / `password123`
- Sample workspaces and connections

### 5. Verify Setup
Open Drizzle Studio to inspect database:
```bash
npm run db:studio
```

### 6. Start Development Server
```bash
npm run dev
```

## Complete Setup Command
Run everything in one command:
```bash
npm run setup
```
This will install dependencies, migrate database, and seed data.

## Troubleshooting

### Connection Issues
- Ensure connection string includes `?sslmode=require`
- Check if IP is whitelisted in Neon dashboard
- Verify database name and credentials

### Migration Errors
- If schema conflicts occur, you can reset:
  ```bash
  # Drop all tables (CAUTION: destroys all data)
  # Then re-run migrations
  npm run db:push
  ```

### pgvector Extension
If queries fail with vector-related errors:
1. Go to Neon dashboard
2. Navigate to Extensions
3. Enable `pgvector` extension
4. Re-run migrations

## Environment Variables
Ensure all required variables are set:
```env
DATABASE_URL=your_neon_connection_string
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_secret_key
ENCRYPTION_SECRET=32_char_encryption_key
GEMINI_API_KEY=your_gemini_api_key
```

## Vercel Deployment

### Required Environment Variables for Vercel:
1. Go to Vercel Dashboard → Settings → Environment Variables
2. Add these variables:
   - `DATABASE_URL` - Your Neon connection string
   - `NEXTAUTH_URL` - Your production URL (e.g., https://yourapp.vercel.app)
   - `NEXTAUTH_SECRET` - Generate with: `openssl rand -base64 32`
   - `ENCRYPTION_SECRET` - Generate with: `openssl rand -hex 16`
   - `GEMINI_API_KEY` - Your Google Gemini API key

### Build Configuration:
- Build Command: `npm run build`
- Output Directory: `.next`
- Install Command: `pnpm install`

### Important Notes:
- Ensure DATABASE_URL includes `?sslmode=require` for Neon
- NEXTAUTH_URL must match your production domain exactly
- Run migrations after first deployment: `npm run db:migrate`

## Next Steps
1. Login with seeded credentials
2. Create a workspace
3. Add database connections
4. Start generating AI-powered queries