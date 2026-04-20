-- Add csrf_token and created_at to sessions (via table rebuild for SQLite).

CREATE TABLE sessions_new (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  csrf_token TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Migrate existing sessions with a throwaway csrf_token using hex of randomblob(32).
-- (Users will have to log in again anyway because TTL shortened to 24h.)
INSERT INTO sessions_new (id, user_id, csrf_token, created_at, expires_at)
SELECT id, user_id,
       lower(hex(randomblob(32))),
       COALESCE(created_at, CURRENT_TIMESTAMP),
       expires_at
FROM sessions;

DROP TABLE sessions;
ALTER TABLE sessions_new RENAME TO sessions;

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
