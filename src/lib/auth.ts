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
  csrfToken: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface SessionWithCsrf {
  id: string;
  csrfToken: string;
}

export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export const SESSION_ROTATE_AFTER_MS = 60 * 60 * 1000;

export function generateSessionId(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function stringToUint8Array(str: string): Uint8Array<ArrayBuffer> {
  const encoded = new TextEncoder().encode(str);
  return new Uint8Array(encoded.buffer as ArrayBuffer);
}

function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const match = hex.match(/.{2}/g);
  if (!match) return new Uint8Array(new ArrayBuffer(0));
  return new Uint8Array(new ArrayBuffer(match.length)).map((_, i) => parseInt(match[i], 16));
}

export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iterations = 100000;

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    stringToUint8Array(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  );

  const saltHex = bufferToHex(salt);
  const hashHex = bufferToHex(derivedBits);

  return `${iterations}$${saltHex}$${hashHex}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const parts = storedHash.split('$');
    if (parts.length !== 3) return false;

    const iterations = parseInt(parts[0], 10);
    if (!Number.isFinite(iterations) || iterations < 1) return false;

    const salt = hexToBytes(parts[1]);
    const expected = hexToBytes(parts[2]);

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      stringToUint8Array(password),
      'PBKDF2',
      false,
      ['deriveBits'],
    );

    const derivedBits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      keyMaterial,
      256,
    );

    return constantTimeEqual(new Uint8Array(derivedBits), expected);
  } catch {
    return false;
  }
}

export function generateCsrfToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createSession(db: D1Database, userId: number): Promise<SessionWithCsrf> {
  const sessionId = generateSessionId();
  const csrfToken = generateCsrfToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  await db
    .prepare(
      'INSERT INTO sessions (id, user_id, csrf_token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(sessionId, userId, csrfToken, expiresAt.toISOString(), now.toISOString())
    .run();

  return { id: sessionId, csrfToken };
}

export async function getSession(db: D1Database, sessionId: string): Promise<Session | null> {
  const result = await db
    .prepare(
      `SELECT id, user_id as userId, csrf_token as csrfToken,
              created_at as createdAt, expires_at as expiresAt
         FROM sessions WHERE id = ?`,
    )
    .bind(sessionId)
    .first<{
      id: string;
      userId: number;
      csrfToken: string;
      createdAt: string;
      expiresAt: string;
    }>();

  if (!result) return null;

  const expiresAt = new Date(result.expiresAt);
  if (expiresAt < new Date()) {
    await deleteSession(db, sessionId);
    return null;
  }

  return {
    id: result.id,
    userId: result.userId,
    csrfToken: result.csrfToken,
    createdAt: new Date(result.createdAt),
    expiresAt,
  };
}

export async function deleteSession(db: D1Database, sessionId: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
}

export async function rotateSessionIfStale(
  db: D1Database,
  session: Session,
): Promise<SessionWithCsrf> {
  const age = Date.now() - session.createdAt.getTime();
  if (age < SESSION_ROTATE_AFTER_MS) {
    return { id: session.id, csrfToken: session.csrfToken };
  }
  const fresh = await createSession(db, session.userId);
  await deleteSession(db, session.id);
  return fresh;
}

export async function getUserBySession(db: D1Database, sessionId: string): Promise<User | null> {
  const session = await getSession(db, sessionId);
  if (!session) return null;

  const result = await db
    .prepare('SELECT id, username, email, google_id as googleId, role FROM users WHERE id = ?')
    .bind(session.userId)
    .first<User>();

  return result || null;
}

export async function authenticateUser(
  db: D1Database,
  username: string,
  password: string,
): Promise<User | null> {
  const result = await db
    .prepare(
      'SELECT id, username, email, google_id as googleId, role, password_hash as passwordHash FROM users WHERE username = ?',
    )
    .bind(username)
    .first<User & { passwordHash: string }>();

  if (!result) return null;
  if (!(await verifyPassword(password, result.passwordHash))) return null;

  return {
    id: result.id,
    username: result.username,
    email: result.email,
    googleId: result.googleId,
    role: result.role,
  };
}

export async function getUserByGoogleId(db: D1Database, googleId: string): Promise<User | null> {
  const result = await db
    .prepare(
      'SELECT id, username, email, google_id as googleId, role FROM users WHERE google_id = ?',
    )
    .bind(googleId)
    .first<User>();

  return result || null;
}

export async function createGoogleUser(
  db: D1Database,
  googleId: string,
  email: string,
  _name: string,
): Promise<User> {
  const username = email.split('@')[0];

  let finalUsername = username;
  let counter = 1;
  let existing = await db
    .prepare('SELECT id FROM users WHERE username = ?')
    .bind(finalUsername)
    .first();

  while (existing) {
    finalUsername = `${username}${counter}`;
    counter++;
    existing = await db
      .prepare('SELECT id FROM users WHERE username = ?')
      .bind(finalUsername)
      .first();
  }

  const result = await db
    .prepare(
      `INSERT INTO users (username, email, google_id, password_hash, role)
     VALUES (?, ?, ?, NULL, 'user')
     RETURNING id, username, email, google_id as googleId, role`,
    )
    .bind(finalUsername, email, googleId)
    .first<User>();

  if (!result) {
    throw new Error('Failed to create Google user');
  }

  return result;
}

export async function findOrCreateGoogleUser(
  db: D1Database,
  googleId: string,
  email: string,
  name: string,
): Promise<User> {
  const existingUser = await getUserByGoogleId(db, googleId);

  if (existingUser) {
    return existingUser;
  }

  return await createGoogleUser(db, googleId, email, name);
}

export function isAdmin(user: User): boolean {
  return user.role === 'admin';
}

export function canModifyPost(user: User, postUserId: number | null): boolean {
  if (isAdmin(user)) return true;

  return postUserId === user.id;
}

export function canViewAllPosts(user: User): boolean {
  return isAdmin(user);
}
