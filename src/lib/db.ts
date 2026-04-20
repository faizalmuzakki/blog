import type { D1Database } from '@cloudflare/workers-types';

export type PostStatus = 'draft' | 'published';

export const DEFAULT_LANGUAGE = 'en';

export interface Post {
  id: number;
  title: string;
  slug: string;
  language: string;
  description: string;
  content: string;
  status: PostStatus;
  heroImage: string | null;
  translationGroupId: string | null;
  composeSessionId: number | null;
  createdAt: string;
  updatedAt: string;
  userId: number | null;
  authorUsername?: string | null;
}

export interface PostInput {
  title: string;
  slug: string;
  language?: string;
  description: string;
  content: string;
  status: PostStatus;
  heroImage?: string | null;
  translationGroupId?: string | null;
  composeSessionId?: number | null;
  userId: number;
}

const POST_COLUMNS = `
  p.id, p.title, p.slug, p.language, p.description, p.content, p.status,
  p.hero_image as heroImage,
  p.translation_group_id as translationGroupId,
  p.compose_session_id as composeSessionId,
  p.created_at as createdAt,
  p.updated_at as updatedAt, p.user_id as userId,
  u.username as authorUsername
`;

export async function getPublishedPosts(db: D1Database): Promise<Post[]> {
  const result = await db
    .prepare(
      `SELECT ${POST_COLUMNS}
         FROM posts p LEFT JOIN users u ON p.user_id = u.id
         WHERE p.status = 'published'
         ORDER BY p.created_at DESC`,
    )
    .all<Post>();
  return result.results || [];
}

export async function getAllPosts(db: D1Database): Promise<Post[]> {
  const result = await db
    .prepare(
      `SELECT ${POST_COLUMNS}
         FROM posts p LEFT JOIN users u ON p.user_id = u.id
         ORDER BY p.created_at DESC`,
    )
    .all<Post>();
  return result.results || [];
}

export async function getPostsByUser(db: D1Database, userId: number): Promise<Post[]> {
  const result = await db
    .prepare(
      `SELECT ${POST_COLUMNS}
         FROM posts p LEFT JOIN users u ON p.user_id = u.id
         WHERE p.user_id = ?
         ORDER BY p.created_at DESC`,
    )
    .bind(userId)
    .all<Post>();
  return result.results || [];
}

export async function getPostBySlug(
  db: D1Database,
  slug: string,
  language: string = DEFAULT_LANGUAGE,
): Promise<Post | null> {
  const result = await db
    .prepare(
      `SELECT ${POST_COLUMNS}
         FROM posts p LEFT JOIN users u ON p.user_id = u.id
         WHERE p.slug = ? AND p.language = ?`,
    )
    .bind(slug, language)
    .first<Post>();
  return result || null;
}

export async function getPostsByTranslationGroup(
  db: D1Database,
  groupId: string,
): Promise<Post[]> {
  const result = await db
    .prepare(
      `SELECT ${POST_COLUMNS}
         FROM posts p LEFT JOIN users u ON p.user_id = u.id
         WHERE p.translation_group_id = ?
         ORDER BY p.language ASC`,
    )
    .bind(groupId)
    .all<Post>();
  return result.results || [];
}

export async function getPostById(db: D1Database, id: number): Promise<Post | null> {
  const result = await db
    .prepare(
      `SELECT ${POST_COLUMNS}
         FROM posts p LEFT JOIN users u ON p.user_id = u.id
         WHERE p.id = ?`,
    )
    .bind(id)
    .first<Post>();
  return result || null;
}

export async function createPost(db: D1Database, post: PostInput): Promise<Post> {
  const now = new Date().toISOString();
  const result = await db
    .prepare(
      `INSERT INTO posts
         (title, slug, language, description, content, status, hero_image,
          translation_group_id, compose_session_id, user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id, title, slug, language, description, content, status,
                 hero_image as heroImage,
                 translation_group_id as translationGroupId,
                 compose_session_id as composeSessionId,
                 created_at as createdAt,
                 updated_at as updatedAt, user_id as userId`,
    )
    .bind(
      post.title,
      post.slug,
      post.language ?? DEFAULT_LANGUAGE,
      post.description,
      post.content,
      post.status,
      post.heroImage ?? null,
      post.translationGroupId ?? null,
      post.composeSessionId ?? null,
      post.userId,
      now,
      now,
    )
    .first<Post>();
  if (!result) throw new Error('Failed to create post');
  return result;
}

export async function updatePost(
  db: D1Database,
  id: number,
  post: Partial<PostInput>,
): Promise<Post> {
  const now = new Date().toISOString();
  const current = await getPostById(db, id);
  if (!current) throw new Error('Post not found');

  const result = await db
    .prepare(
      `UPDATE posts SET
         title = ?, slug = ?, description = ?, content = ?,
         status = ?, hero_image = ?, updated_at = ?
       WHERE id = ?
       RETURNING id, title, slug, description, content, status,
                 hero_image as heroImage, created_at as createdAt,
                 updated_at as updatedAt, user_id as userId`,
    )
    .bind(
      post.title ?? current.title,
      post.slug ?? current.slug,
      post.description ?? current.description,
      post.content ?? current.content,
      post.status ?? current.status,
      post.heroImage !== undefined ? post.heroImage : current.heroImage,
      now,
      id,
    )
    .first<Post>();
  if (!result) throw new Error('Failed to update post');
  return result;
}

export async function deletePost(db: D1Database, id: number): Promise<void> {
  await db.prepare('DELETE FROM posts WHERE id = ?').bind(id).run();
}

export function generateSlug(title: string): string {
  const base = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return base || 'post';
}

export async function slugExists(
  db: D1Database,
  slug: string,
  language: string = DEFAULT_LANGUAGE,
  excludeId?: number,
): Promise<boolean> {
  let query = 'SELECT 1 FROM posts WHERE slug = ? AND language = ?';
  const params: (string | number)[] = [slug, language];
  if (excludeId !== undefined) {
    query += ' AND id != ?';
    params.push(excludeId);
  }
  const result = await db
    .prepare(query)
    .bind(...params)
    .first();
  return result !== null;
}

export async function uniqueSlug(
  db: D1Database,
  base: string,
  language: string = DEFAULT_LANGUAGE,
  excludeId?: number,
): Promise<string> {
  let candidate = base;
  let n = 2;
  while (await slugExists(db, candidate, language, excludeId)) {
    candidate = `${base}-${n++}`;
  }
  return candidate;
}
