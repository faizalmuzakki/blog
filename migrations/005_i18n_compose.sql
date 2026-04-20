-- i18n posts + compose sessions.
--
-- posts: add `language`, `translation_group_id`, `compose_session_id`;
-- replace global UNIQUE(slug) with UNIQUE(slug, language).
--
-- compose_sessions: persists the raw input, chosen target languages,
-- and the AI-generated drafts keyed by language, so the user can come
-- back and keep editing before publishing.

CREATE TABLE posts_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  description TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft', 'published')),
  hero_image TEXT,
  user_id INTEGER,
  translation_group_id TEXT,
  compose_session_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO posts_new (
  id, title, slug, language, description, content, status, hero_image,
  user_id, translation_group_id, compose_session_id, created_at, updated_at
)
SELECT
  id, title, slug, 'en', description, content, status, hero_image,
  user_id, NULL, NULL, created_at, updated_at
FROM posts;

DROP TABLE posts;
ALTER TABLE posts_new RENAME TO posts;

CREATE UNIQUE INDEX idx_posts_slug_language ON posts(slug, language);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_created_at ON posts(created_at);
CREATE INDEX idx_posts_language ON posts(language);
CREATE INDEX idx_posts_translation_group ON posts(translation_group_id);

CREATE TABLE IF NOT EXISTS compose_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  original_text TEXT NOT NULL DEFAULT '',
  source_language TEXT NOT NULL DEFAULT 'en',
  target_languages TEXT NOT NULL DEFAULT '[]',
  generated_drafts TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'generating', 'generated', 'published')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_compose_sessions_user_id ON compose_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_compose_sessions_status ON compose_sessions(status);
CREATE INDEX IF NOT EXISTS idx_compose_sessions_updated_at ON compose_sessions(updated_at);
