// Database utilities and types

import type { D1Database } from '@cloudflare/workers-types';

export interface Post {
  id: number;
  title: string;
  slug: string;
  description: string;
  content: string;
  isPrivate: boolean;
  privatePassword: string | null;
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
  isPrivate: boolean;
  privatePassword?: string;
  heroImage?: string;
  userId: number;
}

// Get all public posts
export async function getPublicPosts(db: D1Database): Promise<Post[]> {
  const result = await db.prepare(
    `SELECT
      p.id, p.title, p.slug, p.description, p.content,
      p.is_private as isPrivate, p.private_password as privatePassword,
      p.hero_image as heroImage, p.created_at as createdAt,
      p.updated_at as updatedAt, p.user_id as userId,
      u.username as authorUsername
    FROM posts p
    LEFT JOIN users u ON p.user_id = u.id
    WHERE p.is_private = 0
    ORDER BY p.created_at DESC`
  ).all<Post>();

  // Convert isPrivate from integer to boolean
  return (result.results || []).map(post => ({
    ...post,
    isPrivate: Boolean(post.isPrivate)
  }));
}

// Get all posts (including private) - for admin
export async function getAllPosts(db: D1Database): Promise<Post[]> {
  const result = await db.prepare(
    `SELECT
      p.id, p.title, p.slug, p.description, p.content,
      p.is_private as isPrivate, p.private_password as privatePassword,
      p.hero_image as heroImage, p.created_at as createdAt,
      p.updated_at as updatedAt, p.user_id as userId,
      u.username as authorUsername
    FROM posts p
    LEFT JOIN users u ON p.user_id = u.id
    ORDER BY p.created_at DESC`
  ).all<Post>();

  // Convert isPrivate from integer to boolean
  return (result.results || []).map(post => ({
    ...post,
    isPrivate: Boolean(post.isPrivate)
  }));
}

// Get post by slug
export async function getPostBySlug(db: D1Database, slug: string): Promise<Post | null> {
  const result = await db.prepare(
    `SELECT
      id, title, slug, description, content,
      is_private as isPrivate, private_password as privatePassword,
      hero_image as heroImage, created_at as createdAt,
      updated_at as updatedAt, user_id as userId
    FROM posts
    WHERE slug = ?`
  ).bind(slug).first<Post>();

  if (!result) return null;

  // Convert isPrivate from integer to boolean
  return {
    ...result,
    isPrivate: Boolean(result.isPrivate)
  };
}

// Get post by ID
export async function getPostById(db: D1Database, id: number): Promise<Post | null> {
  const result = await db.prepare(
    `SELECT
      id, title, slug, description, content,
      is_private as isPrivate, private_password as privatePassword,
      hero_image as heroImage, created_at as createdAt,
      updated_at as updatedAt, user_id as userId
    FROM posts
    WHERE id = ?`
  ).bind(id).first<Post>();

  if (!result) return null;

  // Convert isPrivate from integer to boolean
  return {
    ...result,
    isPrivate: Boolean(result.isPrivate)
  };
}

// Create a new post
export async function createPost(db: D1Database, post: PostInput): Promise<Post> {
  const now = new Date().toISOString();

  const result = await db.prepare(
    `INSERT INTO posts
      (title, slug, description, content, is_private, private_password, hero_image, user_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING
      id, title, slug, description, content,
      is_private as isPrivate, private_password as privatePassword,
      hero_image as heroImage, created_at as createdAt,
      updated_at as updatedAt, user_id as userId`
  ).bind(
    post.title,
    post.slug,
    post.description,
    post.content,
    post.isPrivate ? 1 : 0,
    post.privatePassword || null,
    post.heroImage || null,
    post.userId,
    now,
    now
  ).first<Post>();

  if (!result) {
    throw new Error('Failed to create post');
  }

  // Convert isPrivate from integer to boolean
  return {
    ...result,
    isPrivate: Boolean(result.isPrivate)
  };
}

// Update a post
export async function updatePost(
  db: D1Database,
  id: number,
  post: Partial<PostInput>
): Promise<Post> {
  const now = new Date().toISOString();

  // Get the current post first
  const currentPost = await getPostById(db, id);
  if (!currentPost) {
    throw new Error('Post not found');
  }

  const result = await db.prepare(
    `UPDATE posts SET
      title = ?,
      slug = ?,
      description = ?,
      content = ?,
      is_private = ?,
      private_password = ?,
      hero_image = ?,
      updated_at = ?
    WHERE id = ?
    RETURNING
      id, title, slug, description, content,
      is_private as isPrivate, private_password as privatePassword,
      hero_image as heroImage, created_at as createdAt,
      updated_at as updatedAt, user_id as userId`
  ).bind(
    post.title ?? currentPost.title,
    post.slug ?? currentPost.slug,
    post.description ?? currentPost.description,
    post.content ?? currentPost.content,
    post.isPrivate !== undefined ? (post.isPrivate ? 1 : 0) : currentPost.isPrivate ? 1 : 0,
    post.privatePassword ?? currentPost.privatePassword,
    post.heroImage ?? currentPost.heroImage,
    now,
    id
  ).first<Post>();

  if (!result) {
    throw new Error('Failed to update post');
  }

  // Convert isPrivate from integer to boolean
  return {
    ...result,
    isPrivate: Boolean(result.isPrivate)
  };
}

// Delete a post
export async function deletePost(db: D1Database, id: number): Promise<void> {
  await db.prepare('DELETE FROM posts WHERE id = ?').bind(id).run();
}

// Generate slug from title
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Check if slug exists
export async function slugExists(db: D1Database, slug: string, excludeId?: number): Promise<boolean> {
  let query = 'SELECT COUNT(*) as count FROM posts WHERE slug = ?';
  const params: (string | number)[] = [slug];

  if (excludeId) {
    query += ' AND id != ?';
    params.push(excludeId);
  }

  const result = await db.prepare(query).bind(...params).first<{ count: number }>();
  return (result?.count || 0) > 0;
}
