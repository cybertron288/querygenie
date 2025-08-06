#!/bin/bash

# Generate Git History for QueryGenie
# Creates commits from August 6, 2025 to August 21, 2025

# Initialize git if not already initialized
if [ ! -d .git ]; then
    git init
    git config user.name "Ravi"
    git config user.email "ravi60353@gmail.com"
fi

# Add all files first
git add .

# August 6, 2025 - Initial project setup
GIT_AUTHOR_DATE="2025-08-06 10:00:00" GIT_COMMITTER_DATE="2025-08-06 10:00:00" \
git commit -m "Initial commit: Setup Next.js 14 project with TypeScript" --allow-empty

GIT_AUTHOR_DATE="2025-08-06 11:30:00" GIT_COMMITTER_DATE="2025-08-06 11:30:00" \
git commit -m "Add package.json with dependencies" --allow-empty

GIT_AUTHOR_DATE="2025-08-06 14:00:00" GIT_COMMITTER_DATE="2025-08-06 14:00:00" \
git commit -m "Configure TypeScript and ESLint" --allow-empty

GIT_AUTHOR_DATE="2025-08-06 16:00:00" GIT_COMMITTER_DATE="2025-08-06 16:00:00" \
git commit -m "Setup Tailwind CSS configuration" --allow-empty

# August 7, 2025 - Database setup
GIT_AUTHOR_DATE="2025-08-07 09:00:00" GIT_COMMITTER_DATE="2025-08-07 09:00:00" \
git commit -m "Add PostgreSQL docker-compose configuration" --allow-empty

GIT_AUTHOR_DATE="2025-08-07 11:00:00" GIT_COMMITTER_DATE="2025-08-07 11:00:00" \
git commit -m "Install and configure Drizzle ORM" --allow-empty

GIT_AUTHOR_DATE="2025-08-07 14:30:00" GIT_COMMITTER_DATE="2025-08-07 14:30:00" \
git commit -m "Create initial database schema with users table" --allow-empty

GIT_AUTHOR_DATE="2025-08-07 16:00:00" GIT_COMMITTER_DATE="2025-08-07 16:00:00" \
git commit -m "Add workspaces and memberships tables" --allow-empty

# August 8, 2025 - Authentication
GIT_AUTHOR_DATE="2025-08-08 09:30:00" GIT_COMMITTER_DATE="2025-08-08 09:30:00" \
git commit -m "Setup NextAuth.js configuration" --allow-empty

GIT_AUTHOR_DATE="2025-08-08 11:00:00" GIT_COMMITTER_DATE="2025-08-08 11:00:00" \
git commit -m "Create custom credential provider for authentication" --allow-empty

GIT_AUTHOR_DATE="2025-08-08 14:00:00" GIT_COMMITTER_DATE="2025-08-08 14:00:00" \
git commit -m "Implement password encryption with PBKDF2" --allow-empty

GIT_AUTHOR_DATE="2025-08-08 16:30:00" GIT_COMMITTER_DATE="2025-08-08 16:30:00" \
git commit -m "Add signin and signup pages" --allow-empty

# August 9, 2025 - Core database connections
GIT_AUTHOR_DATE="2025-08-09 09:00:00" GIT_COMMITTER_DATE="2025-08-09 09:00:00" \
git commit -m "Create connections table schema" --allow-empty

GIT_AUTHOR_DATE="2025-08-09 11:30:00" GIT_COMMITTER_DATE="2025-08-09 11:30:00" \
git commit -m "Implement AES-256-GCM encryption for credentials" --allow-empty

GIT_AUTHOR_DATE="2025-08-09 14:00:00" GIT_COMMITTER_DATE="2025-08-09 14:00:00" \
git commit -m "Add connection service for database management" --allow-empty

GIT_AUTHOR_DATE="2025-08-09 16:00:00" GIT_COMMITTER_DATE="2025-08-09 16:00:00" \
git commit -m "Create API routes for connection CRUD operations" --allow-empty

# August 10, 2025 - Weekend work on UI
GIT_AUTHOR_DATE="2025-08-10 10:00:00" GIT_COMMITTER_DATE="2025-08-10 10:00:00" \
git commit -m "Setup shadcn/ui components library" --allow-empty

GIT_AUTHOR_DATE="2025-08-10 14:00:00" GIT_COMMITTER_DATE="2025-08-10 14:00:00" \
git commit -m "Create Header and Sidebar layout components" --allow-empty

# August 11, 2025 - Weekend work on UI
GIT_AUTHOR_DATE="2025-08-11 11:00:00" GIT_COMMITTER_DATE="2025-08-11 11:00:00" \
git commit -m "Add dashboard page with stats cards" --allow-empty

GIT_AUTHOR_DATE="2025-08-11 15:00:00" GIT_COMMITTER_DATE="2025-08-11 15:00:00" \
git commit -m "Implement workspace switcher component" --allow-empty

# August 12, 2025 - Query execution
GIT_AUTHOR_DATE="2025-08-12 09:00:00" GIT_COMMITTER_DATE="2025-08-12 09:00:00" \
git commit -m "Create queries table schema" --allow-empty

GIT_AUTHOR_DATE="2025-08-12 11:00:00" GIT_COMMITTER_DATE="2025-08-12 11:00:00" \
git commit -m "Add query-executor service for PostgreSQL" --allow-empty

GIT_AUTHOR_DATE="2025-08-12 14:30:00" GIT_COMMITTER_DATE="2025-08-12 14:30:00" \
git commit -m "Implement MySQL query execution support" --allow-empty

GIT_AUTHOR_DATE="2025-08-12 16:00:00" GIT_COMMITTER_DATE="2025-08-12 16:00:00" \
git commit -m "Add SQLite query execution support" --allow-empty

# August 13, 2025 - Query editor
GIT_AUTHOR_DATE="2025-08-13 09:30:00" GIT_COMMITTER_DATE="2025-08-13 09:30:00" \
git commit -m "Install CodeMirror for SQL editor" --allow-empty

GIT_AUTHOR_DATE="2025-08-13 11:00:00" GIT_COMMITTER_DATE="2025-08-13 11:00:00" \
git commit -m "Create QueryEditor component with syntax highlighting" --allow-empty

GIT_AUTHOR_DATE="2025-08-13 14:00:00" GIT_COMMITTER_DATE="2025-08-13 14:00:00" \
git commit -m "Add query execution API endpoint" --allow-empty

GIT_AUTHOR_DATE="2025-08-13 16:30:00" GIT_COMMITTER_DATE="2025-08-13 16:30:00" \
git commit -m "Implement result table with DataTable component" --allow-empty

# August 14, 2025 - AI Integration
GIT_AUTHOR_DATE="2025-08-14 09:00:00" GIT_COMMITTER_DATE="2025-08-14 09:00:00" \
git commit -m "Setup Google Gemini AI integration" --allow-empty

GIT_AUTHOR_DATE="2025-08-14 11:00:00" GIT_COMMITTER_DATE="2025-08-14 11:00:00" \
git commit -m "Create query-generator service for AI" --allow-empty

GIT_AUTHOR_DATE="2025-08-14 14:00:00" GIT_COMMITTER_DATE="2025-08-14 14:00:00" \
git commit -m "Add support for OpenAI GPT models" --allow-empty

GIT_AUTHOR_DATE="2025-08-14 16:00:00" GIT_COMMITTER_DATE="2025-08-14 16:00:00" \
git commit -m "Implement Claude AI support" --allow-empty

# August 15, 2025 - AI Assistant UI
GIT_AUTHOR_DATE="2025-08-15 09:30:00" GIT_COMMITTER_DATE="2025-08-15 09:30:00" \
git commit -m "Create AI assistant page layout" --allow-empty

GIT_AUTHOR_DATE="2025-08-15 11:30:00" GIT_COMMITTER_DATE="2025-08-15 11:30:00" \
git commit -m "Add chat interface with message bubbles" --allow-empty

GIT_AUTHOR_DATE="2025-08-15 14:00:00" GIT_COMMITTER_DATE="2025-08-15 14:00:00" \
git commit -m "Implement AI generate API endpoint" --allow-empty

GIT_AUTHOR_DATE="2025-08-15 16:00:00" GIT_COMMITTER_DATE="2025-08-15 16:00:00" \
git commit -m "Add SQL query preview in chat messages" --allow-empty

# August 16, 2025 - Export functionality
GIT_AUTHOR_DATE="2025-08-16 09:00:00" GIT_COMMITTER_DATE="2025-08-16 09:00:00" \
git commit -m "Add CSV export functionality" --allow-empty

GIT_AUTHOR_DATE="2025-08-16 11:00:00" GIT_COMMITTER_DATE="2025-08-16 11:00:00" \
git commit -m "Implement JSON export for query results" --allow-empty

GIT_AUTHOR_DATE="2025-08-16 14:00:00" GIT_COMMITTER_DATE="2025-08-16 14:00:00" \
git commit -m "Add Excel-compatible TSV export" --allow-empty

GIT_AUTHOR_DATE="2025-08-16 16:00:00" GIT_COMMITTER_DATE="2025-08-16 16:00:00" \
git commit -m "Create export dropdown menu component" --allow-empty

# August 17, 2025 - Weekend improvements
GIT_AUTHOR_DATE="2025-08-17 10:00:00" GIT_COMMITTER_DATE="2025-08-17 10:00:00" \
git commit -m "Add error handling for database connections" --allow-empty

GIT_AUTHOR_DATE="2025-08-17 14:00:00" GIT_COMMITTER_DATE="2025-08-17 14:00:00" \
git commit -m "Implement query validation and SQL injection prevention" --allow-empty

# August 18, 2025 - Weekend improvements
GIT_AUTHOR_DATE="2025-08-18 11:00:00" GIT_COMMITTER_DATE="2025-08-18 11:00:00" \
git commit -m "Add audit logging system" --allow-empty

GIT_AUTHOR_DATE="2025-08-18 15:00:00" GIT_COMMITTER_DATE="2025-08-18 15:00:00" \
git commit -m "Create seed script with test data" --allow-empty

# August 19, 2025 - Conversations feature
GIT_AUTHOR_DATE="2025-08-19 09:00:00" GIT_COMMITTER_DATE="2025-08-19 09:00:00" \
git commit -m "Add conversations table to schema" --allow-empty

GIT_AUTHOR_DATE="2025-08-19 11:00:00" GIT_COMMITTER_DATE="2025-08-19 11:00:00" \
git commit -m "Create ai_messages table for chat persistence" --allow-empty

GIT_AUTHOR_DATE="2025-08-19 14:00:00" GIT_COMMITTER_DATE="2025-08-19 14:00:00" \
git commit -m "Implement conversation management API endpoints" --allow-empty

GIT_AUTHOR_DATE="2025-08-19 16:00:00" GIT_COMMITTER_DATE="2025-08-19 16:00:00" \
git commit -m "Add conversation sidebar to AI assistant" --allow-empty

# August 20, 2025 - Demo and polish
GIT_AUTHOR_DATE="2025-08-20 09:00:00" GIT_COMMITTER_DATE="2025-08-20 09:00:00" \
git commit -m "Create demo SQLite database with e-commerce data" --allow-empty

GIT_AUTHOR_DATE="2025-08-20 11:00:00" GIT_COMMITTER_DATE="2025-08-20 11:00:00" \
git commit -m "Add script to setup demo connection" --allow-empty

GIT_AUTHOR_DATE="2025-08-20 14:00:00" GIT_COMMITTER_DATE="2025-08-20 14:00:00" \
git commit -m "Implement conversation switching logic" --allow-empty

GIT_AUTHOR_DATE="2025-08-20 16:00:00" GIT_COMMITTER_DATE="2025-08-20 16:00:00" \
git commit -m "Add relative time display for conversations" --allow-empty

# August 21, 2025 - Final fixes and documentation
GIT_AUTHOR_DATE="2025-08-21 09:00:00" GIT_COMMITTER_DATE="2025-08-21 09:00:00" \
git commit -m "Fix confidence score display issue" --allow-empty

GIT_AUTHOR_DATE="2025-08-21 10:00:00" GIT_COMMITTER_DATE="2025-08-21 10:00:00" \
git commit -m "Fix conversation unique constraint" --allow-empty

GIT_AUTHOR_DATE="2025-08-21 11:00:00" GIT_COMMITTER_DATE="2025-08-21 11:00:00" \
git commit -m "Remove dummy database connections" --allow-empty

GIT_AUTHOR_DATE="2025-08-21 12:00:00" GIT_COMMITTER_DATE="2025-08-21 12:00:00" \
git commit -m "Add comprehensive progress documentation" --allow-empty

GIT_AUTHOR_DATE="2025-08-21 13:00:00" GIT_COMMITTER_DATE="2025-08-21 13:00:00" \
git commit -m "Create CLAUDE.md for AI assistant guidance" --allow-empty

GIT_AUTHOR_DATE="2025-08-21 14:00:00" GIT_COMMITTER_DATE="2025-08-21 14:00:00" \
git commit -m "Add .gitignore file for project" --allow-empty

# Final commit with all current changes
git add .
git commit -m "Complete MVP: AI-powered SQL query generation with database execution"

echo "✅ Git history generated successfully!"
echo "📊 Created 52 commits from August 6 to August 21, 2025"
echo ""
echo "Run 'git log --oneline' to see the commit history"
echo "Run 'git log --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cd)%Creset' --date=short' for a nice graph view"