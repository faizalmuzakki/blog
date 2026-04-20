import type { D1Database } from '@cloudflare/workers-types';
import type { ComposeGeneration } from './claude-api';

export type ComposeStatus = 'draft' | 'generating' | 'generated' | 'published';

export interface ComposeSession {
  id: number;
  userId: number;
  originalText: string;
  sourceLanguage: string;
  targetLanguages: string[];
  generatedDrafts: Record<string, ComposeGeneration>;
  status: ComposeStatus;
  createdAt: string;
  updatedAt: string;
}

interface ComposeRow {
  id: number;
  user_id: number;
  original_text: string;
  source_language: string;
  target_languages: string;
  generated_drafts: string | null;
  status: ComposeStatus;
  created_at: string;
  updated_at: string;
}

function rowToSession(row: ComposeRow): ComposeSession {
  return {
    id: row.id,
    userId: row.user_id,
    originalText: row.original_text,
    sourceLanguage: row.source_language,
    targetLanguages: safeJson<string[]>(row.target_languages, []),
    generatedDrafts: safeJson<Record<string, ComposeGeneration>>(row.generated_drafts ?? '{}', {}),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function safeJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function createComposeSession(
  db: D1Database,
  userId: number,
  data: { originalText: string; sourceLanguage: string; targetLanguages: string[] },
): Promise<ComposeSession> {
  const now = new Date().toISOString();
  const result = await db
    .prepare(
      `INSERT INTO compose_sessions
         (user_id, original_text, source_language, target_languages, generated_drafts, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)
       RETURNING *`,
    )
    .bind(
      userId,
      data.originalText,
      data.sourceLanguage,
      JSON.stringify(data.targetLanguages),
      '{}',
      now,
      now,
    )
    .first<ComposeRow>();

  if (!result) throw new Error('Failed to create compose session');
  return rowToSession(result);
}

export async function getComposeSession(
  db: D1Database,
  userId: number,
  id: number,
): Promise<ComposeSession | null> {
  const row = await db
    .prepare('SELECT * FROM compose_sessions WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .first<ComposeRow>();
  return row ? rowToSession(row) : null;
}

export async function listComposeSessions(
  db: D1Database,
  userId: number,
  limit = 50,
): Promise<ComposeSession[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM compose_sessions
         WHERE user_id = ?
         ORDER BY updated_at DESC
         LIMIT ?`,
    )
    .bind(userId, limit)
    .all<ComposeRow>();
  return (results ?? []).map(rowToSession);
}

export async function updateComposeSession(
  db: D1Database,
  userId: number,
  id: number,
  patch: Partial<{
    originalText: string;
    sourceLanguage: string;
    targetLanguages: string[];
    generatedDrafts: Record<string, ComposeGeneration>;
    status: ComposeStatus;
  }>,
): Promise<ComposeSession | null> {
  const sets: string[] = [];
  const binds: unknown[] = [];

  if (patch.originalText !== undefined) {
    sets.push('original_text = ?');
    binds.push(patch.originalText);
  }
  if (patch.sourceLanguage !== undefined) {
    sets.push('source_language = ?');
    binds.push(patch.sourceLanguage);
  }
  if (patch.targetLanguages !== undefined) {
    sets.push('target_languages = ?');
    binds.push(JSON.stringify(patch.targetLanguages));
  }
  if (patch.generatedDrafts !== undefined) {
    sets.push('generated_drafts = ?');
    binds.push(JSON.stringify(patch.generatedDrafts));
  }
  if (patch.status !== undefined) {
    sets.push('status = ?');
    binds.push(patch.status);
  }

  if (!sets.length) return getComposeSession(db, userId, id);

  sets.push('updated_at = ?');
  binds.push(new Date().toISOString());
  binds.push(id, userId);

  const result = await db
    .prepare(
      `UPDATE compose_sessions SET ${sets.join(', ')}
         WHERE id = ? AND user_id = ?
         RETURNING *`,
    )
    .bind(...binds)
    .first<ComposeRow>();
  return result ? rowToSession(result) : null;
}

export async function deleteComposeSession(
  db: D1Database,
  userId: number,
  id: number,
): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM compose_sessions WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}
