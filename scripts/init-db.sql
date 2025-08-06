-- =============================================================================
-- QueryGenie Database Initialization Script
-- 
-- This script sets up the database with:
-- - Required extensions
-- - Performance optimizations
-- - Initial configuration
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";       -- Encryption functions
CREATE EXTENSION IF NOT EXISTS "vector";         -- Vector similarity search

-- =============================================================================
-- Performance Configuration
-- =============================================================================

-- Set optimal configuration for development
-- Note: These are suggestions, adjust based on your system
-- ALTER SYSTEM SET shared_buffers = '256MB';
-- ALTER SYSTEM SET effective_cache_size = '1GB';
-- ALTER SYSTEM SET maintenance_work_mem = '64MB';
-- ALTER SYSTEM SET checkpoint_completion_target = 0.9;
-- ALTER SYSTEM SET wal_buffers = '8MB';
-- ALTER SYSTEM SET default_statistics_target = 100;
-- ALTER SYSTEM SET random_page_cost = 1.1;
-- ALTER SYSTEM SET effective_io_concurrency = 200;
-- ALTER SYSTEM SET work_mem = '4MB';
-- ALTER SYSTEM SET min_wal_size = '80MB';
-- ALTER SYSTEM SET max_wal_size = '1GB';

-- =============================================================================
-- Database Roles and Permissions
-- =============================================================================

-- Create application role if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'querygenie_app') THEN
        CREATE ROLE querygenie_app WITH LOGIN PASSWORD 'app_password';
    END IF;
END
$$;

-- Grant permissions
GRANT CONNECT ON DATABASE querygenie TO querygenie_app;
GRANT USAGE ON SCHEMA public TO querygenie_app;
GRANT CREATE ON SCHEMA public TO querygenie_app;

-- Grant permissions on all tables (will apply to tables created later)
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT ALL PRIVILEGES ON TABLES TO querygenie_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT ALL PRIVILEGES ON SEQUENCES TO querygenie_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT EXECUTE ON FUNCTIONS TO querygenie_app;

-- =============================================================================
-- Helper Functions
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to generate a unique slug
CREATE OR REPLACE FUNCTION generate_unique_slug(base_slug TEXT, table_name TEXT)
RETURNS TEXT AS $$
DECLARE
    new_slug TEXT;
    counter INTEGER := 0;
BEGIN
    new_slug := base_slug;
    
    -- Check if slug exists
    LOOP
        EXECUTE format('SELECT 1 FROM %I WHERE slug = $1', table_name) 
        USING new_slug;
        
        IF NOT FOUND THEN
            RETURN new_slug;
        END IF;
        
        counter := counter + 1;
        new_slug := base_slug || '-' || counter;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate query execution time
CREATE OR REPLACE FUNCTION calculate_execution_time(started_at TIMESTAMP, completed_at TIMESTAMP)
RETURNS INTEGER AS $$
BEGIN
    IF completed_at IS NULL THEN
        RETURN NULL;
    END IF;
    
    RETURN EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000; -- Return milliseconds
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- Indexes for Performance
-- =============================================================================

-- Note: These indexes will be created automatically by Drizzle migrations
-- This is just documentation of important indexes

-- Users table indexes
-- CREATE INDEX idx_users_email ON users(email);
-- CREATE INDEX idx_users_active ON users(is_active);
-- CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- Workspaces table indexes
-- CREATE INDEX idx_workspaces_slug ON workspaces(slug);
-- CREATE INDEX idx_workspaces_owner ON workspaces(owner_id);
-- CREATE INDEX idx_workspaces_active ON workspaces(is_active);

-- Memberships table indexes
-- CREATE INDEX idx_memberships_user ON memberships(user_id);
-- CREATE INDEX idx_memberships_workspace ON memberships(workspace_id);
-- CREATE INDEX idx_memberships_role ON memberships(role);
-- CREATE UNIQUE INDEX idx_memberships_user_workspace ON memberships(user_id, workspace_id);

-- Connections table indexes
-- CREATE INDEX idx_connections_workspace ON connections(workspace_id);
-- CREATE INDEX idx_connections_type ON connections(type);
-- CREATE INDEX idx_connections_active ON connections(is_active);

-- Queries table indexes
-- CREATE INDEX idx_queries_workspace ON queries(workspace_id);
-- CREATE INDEX idx_queries_connection ON queries(connection_id);
-- CREATE INDEX idx_queries_created_by ON queries(created_by_id);
-- CREATE INDEX idx_queries_created_at ON queries(created_at DESC);
-- CREATE INDEX idx_queries_saved ON queries(is_saved) WHERE is_saved = true;
-- CREATE INDEX idx_queries_shared ON queries(is_shared) WHERE is_shared = true;

-- Audit logs table indexes
-- CREATE INDEX idx_audit_logs_workspace ON audit_logs(workspace_id);
-- CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
-- CREATE INDEX idx_audit_logs_action ON audit_logs(action);
-- CREATE INDEX idx_audit_logs_resource ON audit_logs(resource);
-- CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- =============================================================================
-- Vector Search Configuration
-- =============================================================================

-- Configure vector similarity search
-- Note: Adjust lists value based on your dataset size
-- Lists = sqrt(number of vectors) is a good starting point

-- Example index for embeddings table (created by Drizzle)
-- CREATE INDEX idx_embeddings_vector ON embeddings 
-- USING ivfflat (embedding vector_cosine_ops)
-- WITH (lists = 100);

-- =============================================================================
-- Row-Level Security Policies (Optional)
-- =============================================================================

-- Enable RLS on sensitive tables
-- ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE queries ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE docs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;

-- Example RLS policy (customize based on your needs)
-- CREATE POLICY workspace_member_access ON connections
--   FOR ALL
--   USING (
--     workspace_id IN (
--       SELECT workspace_id 
--       FROM memberships 
--       WHERE user_id = current_setting('app.current_user_id')::uuid
--         AND is_active = true
--     )
--   );

-- =============================================================================
-- Maintenance Settings
-- =============================================================================

-- Configure autovacuum for high-update tables
-- ALTER TABLE queries SET (autovacuum_vacuum_scale_factor = 0.1);
-- ALTER TABLE audit_logs SET (autovacuum_vacuum_scale_factor = 0.1);
-- ALTER TABLE query_executions SET (autovacuum_vacuum_scale_factor = 0.1);

-- =============================================================================
-- Initial System Configuration
-- =============================================================================

-- Set statement timeout for long-running queries
ALTER DATABASE querygenie SET statement_timeout = '30s';

-- Set lock timeout
ALTER DATABASE querygenie SET lock_timeout = '10s';

-- Set idle in transaction timeout
ALTER DATABASE querygenie SET idle_in_transaction_session_timeout = '5min';

-- Log slow queries (adjust based on your needs)
-- ALTER DATABASE querygenie SET log_min_duration_statement = '1000'; -- Log queries taking > 1 second

-- =============================================================================
-- Database Statistics
-- =============================================================================

-- Update statistics for query planner
-- Run this periodically in production
-- ANALYZE;

-- =============================================================================
-- Success Message
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE 'QueryGenie database initialization completed successfully!';
    RAISE NOTICE 'Extensions enabled: uuid-ossp, pgcrypto, vector';
    RAISE NOTICE 'Helper functions created';
    RAISE NOTICE 'Performance settings configured';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Run Drizzle migrations: npm run db:migrate';
    RAISE NOTICE '2. Seed initial data: npm run db:seed';
    RAISE NOTICE '3. Start the application: npm run dev';
END
$$;