-- Reverse 002: restore is_private / private_password (password data lost).

CREATE TABLE posts_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  content TEXT NOT NULL,
  is_private INTEGER NOT NULL DEFAULT 0,
  private_password TEXT,
  hero_image TEXT,
  user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

INSERT INTO posts_new (id, title, slug, description, content, is_private, private_password,
                       hero_image, user_id, created_at, updated_at)
SELECT id, title, slug, description, content,
       CASE WHEN status = 'draft' THEN 1 ELSE 0 END,
       NULL,
       hero_image, user_id, created_at, updated_at
FROM posts;

DROP TABLE posts;
ALTER TABLE posts_new RENAME TO posts;

CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);
