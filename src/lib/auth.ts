// Authentication utilities

import bcrypt from 'bcryptjs';
import type { D1Database } from '@cloudflare/workers-types';

export interface User {
  id: number;
  username: string;
}

export interface Session {
  id: string;
  userId: number;
  expiresAt: Date;
}

// Generate a random session ID
export function generateSessionId(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Verify password against hash
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Hash a password
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

// Create a new session
export async function createSession(db: D1Database, userId: number): Promise<string> {
  const sessionId = generateSessionId();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // Session expires in 7 days

  await db.prepare(
    'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'
  ).bind(sessionId, userId, expiresAt.toISOString()).run();

  return sessionId;
}

// Get session from database
export async function getSession(db: D1Database, sessionId: string): Promise<Session | null> {
  const result = await db.prepare(
    'SELECT id, user_id as userId, expires_at as expiresAt FROM sessions WHERE id = ?'
  ).bind(sessionId).first<{ id: string; userId: number; expiresAt: string }>();

  if (!result) return null;

  const expiresAt = new Date(result.expiresAt);

  // Check if session is expired
  if (expiresAt < new Date()) {
    await deleteSession(db, sessionId);
    return null;
  }

  return {
    id: result.id,
    userId: result.userId,
    expiresAt,
  };
}

// Delete a session
export async function deleteSession(db: D1Database, sessionId: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
}

// Get user by session
export async function getUserBySession(db: D1Database, sessionId: string): Promise<User | null> {
  const session = await getSession(db, sessionId);
  if (!session) return null;

  const result = await db.prepare(
    'SELECT id, username FROM users WHERE id = ?'
  ).bind(session.userId).first<User>();

  return result || null;
}

// Authenticate user
export async function authenticateUser(
  db: D1Database,
  username: string,
  password: string
): Promise<User | null> {
  const result = await db.prepare(
    'SELECT id, username, password_hash as passwordHash FROM users WHERE username = ?'
  ).bind(username).first<{ id: number; username: string; passwordHash: string }>();

  if (!result) return null;

  const isValid = await verifyPassword(password, result.passwordHash);
  if (!isValid) return null;

  return {
    id: result.id,
    username: result.username,
  };
}
