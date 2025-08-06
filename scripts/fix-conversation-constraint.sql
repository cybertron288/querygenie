-- Fix conversation unique constraint to only apply when isActive = true
-- This allows multiple inactive conversations but only one active conversation per connection per user

-- Drop the existing constraint
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_connection_user_active_unique;

-- Create a partial unique constraint that only applies when is_active = true
CREATE UNIQUE INDEX conversations_connection_user_active_unique 
ON conversations (connection_id, created_by_id) 
WHERE is_active = true;