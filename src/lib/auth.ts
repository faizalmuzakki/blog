// Authentication utilities

import type { D1Database } from '@cloudflare/workers-types';

export interface User {
  id: number;
  username: string;
  email?: string | null;
  googleId?: string | null;
  role: 'admin' | 'user';
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

// Convert string to Uint8Array
function stringToUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

// Convert ArrayBuffer to hex string
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Hash a password using PBKDF2 (Web Crypto API)
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iterations = 100000;

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    stringToUint8Array(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: iterations,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );

  // Format: iterations$salt$hash
  const saltHex = bufferToHex(salt);
  const hashHex = bufferToHex(derivedBits);

  return `${iterations}$${saltHex}$${hashHex}`;
}

// Verify password against hash
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const parts = storedHash.split('$');
    if (parts.length !== 3) return false;

    const iterations = parseInt(parts[0]);
    const salt = new Uint8Array(parts[1].match(/.{2}/g)?.map(byte => parseInt(byte, 16)) || []);
    const storedHashBytes = parts[2];

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      stringToUint8Array(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: iterations,
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    );

    const hashHex = bufferToHex(derivedBits);

    // Constant-time comparison
    return hashHex === storedHashBytes;
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
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
    'SELECT id, username, email, google_id as googleId, role FROM users WHERE id = ?'
  ).bind(session.userId).first<User>();

  return result || null;
}

// Authenticate user
export async function authenticateUser(
  db: D1Database,
  username: string,
  password: string
): Promise<User | null> {
  console.log('[AUTH] Looking up user:', username);

  const result = await db.prepare(
    'SELECT id, username, email, google_id as googleId, role, password_hash as passwordHash FROM users WHERE username = ?'
  ).bind(username).first<User & { passwordHash: string }>();

  if (!result) {
    console.log('[AUTH] User not found:', username);
    return null;
  }

  console.log('[AUTH] User found, verifying password...');
  console.log('[AUTH] Stored hash:', result.passwordHash);

  const isValid = await verifyPassword(password, result.passwordHash);

  console.log('[AUTH] Password valid:', isValid);

  if (!isValid) return null;

  return {
    id: result.id,
    username: result.username,
    email: result.email,
    googleId: result.googleId,
    role: result.role,
  };
}

// Find user by Google ID
export async function getUserByGoogleId(
  db: D1Database,
  googleId: string
): Promise<User | null> {
  const result = await db.prepare(
    'SELECT id, username, email, google_id as googleId, role FROM users WHERE google_id = ?'
  ).bind(googleId).first<User>();

  return result || null;
}

// Create user from Google OAuth
export async function createGoogleUser(
  db: D1Database,
  googleId: string,
  email: string,
  name: string
): Promise<User> {
  // Generate username from email or name
  let username = email.split('@')[0];

  // Check if username exists and make it unique if needed
  let finalUsername = username;
  let counter = 1;

  while (true) {
    const existing = await db.prepare(
      'SELECT id FROM users WHERE username = ?'
    ).bind(finalUsername).first();

    if (!existing) break;

    finalUsername = `${username}${counter}`;
    counter++;
  }

  const result = await db.prepare(
    `INSERT INTO users (username, email, google_id, password_hash, role)
     VALUES (?, ?, ?, NULL, 'user')
     RETURNING id, username, email, google_id as googleId, role`
  ).bind(finalUsername, email, googleId).first<User>();

  if (!result) {
    throw new Error('Failed to create Google user');
  }

  return result;
}

// Find or create Google user
export async function findOrCreateGoogleUser(
  db: D1Database,
  googleId: string,
  email: string,
  name: string
): Promise<User> {
  // Try to find existing user by Google ID
  const existingUser = await getUserByGoogleId(db, googleId);

  if (existingUser) {
    return existingUser;
  }

  // Create new user
  return await createGoogleUser(db, googleId, email, name);
}

// Authorization helpers
export function isAdmin(user: User): boolean {
  return user.role === 'admin';
}

export function canModifyPost(user: User, postUserId: number | null): boolean {
  // Admins can modify any post
  if (isAdmin(user)) return true;

  // Users can only modify their own posts
  return postUserId === user.id;
}

export function canViewAllPosts(user: User): boolean {
  return isAdmin(user);
}
