// Authentication utilities

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
