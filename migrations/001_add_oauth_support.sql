-- Migration: Add OAuth support and roles to users table
-- Run this migration on existing databases

-- Add new columns for OAuth support (without UNIQUE constraint)
-- SQLite doesn't allow adding UNIQUE columns to existing tables
ALTER TABLE users ADD COLUMN email TEXT;
ALTER TABLE users ADD COLUMN google_id TEXT;
ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';

-- Update existing users to be admins (since they were created before roles existed)
UPDATE users SET role = 'admin' WHERE role IS NULL;

-- Make password_hash nullable (already nullable in new schema, but document the change)
-- Note: SQLite doesn't support ALTER COLUMN to change NULL constraints
-- The password_hash will be NULL for OAuth users going forward

-- Add indexes for new columns (indexes enforce uniqueness)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;
