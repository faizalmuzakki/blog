-- Migration: Add OAuth support to users table
-- Run this migration on existing databases

-- Add new columns for OAuth support
ALTER TABLE users ADD COLUMN email TEXT UNIQUE;
ALTER TABLE users ADD COLUMN google_id TEXT UNIQUE;

-- Make password_hash nullable (already nullable in new schema, but document the change)
-- Note: SQLite doesn't support ALTER COLUMN to change NULL constraints
-- The password_hash will be NULL for OAuth users going forward

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
