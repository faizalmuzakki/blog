import type { D1Database } from '@cloudflare/workers-types';

export type PostStatus = 'draft' | 'published';

export interface Post {
  id: number;
  title: string;
  slug: string;
  description: string;
  content: string;
  status: PostStatus;
  heroImage: string | null;
  createdAt: string;
  updatedAt: string;
  userId: number | null;
  authorUsername?: string | null;
}

export interface PostInput {
  title: string;
  slug: string;
  description: string;
  content: string;
  status: PostStatus;
  heroImage?: string | null;
  userId: number;
}

const POST_COLUMNS = `
  p.id, p.title, p.slug, p.description, p.content, p.status,
  p.hero_image as heroImage, p.created_at as createdAt,
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

export async function getPostBySlug(db: D1Database, slug: string): Promise<Post | null> {
  const result = await db
    .prepare(
      `SELECT ${POST_COLUMNS}
         FROM posts p LEFT JOIN users u ON p.user_id = u.id
         WHERE p.slug = ?`,
    )
    .bind(slug)
    .first<Post>();
  return result || null;
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
      `INSERT INTO posts (title, slug, description, content, status, hero_image, user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id, title, slug, description, content, status,
                 hero_image as heroImage, created_at as createdAt,
                 updated_at as updatedAt, user_id as userId`,
    )
    .bind(
      post.title,
      post.slug,
      post.description,
      post.content,
      post.status,
      post.heroImage ?? null,
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
  excludeId?: number,
): Promise<boolean> {
  let query = 'SELECT 1 FROM posts WHERE slug = ?';
  const params: (string | number)[] = [slug];
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
  excludeId?: number,
): Promise<string> {
  let candidate = base;
  let n = 2;
  while (await slugExists(db, candidate, excludeId)) {
    candidate = `${base}-${n++}`;
  }
  return candidate;
}
