# Blog Hardening and Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close real security holes (XSS, fake private posts, timing attacks, default creds), add auth hardening (CSRF, session rotation, cascade deletes), set up tests + dev tooling, and publish RSS/sitemap/robots — all in one PR with grouped commits.

**Architecture:** Astro SSR app running on Cloudflare Pages with a D1 SQLite database. Changes live in `src/lib/*` (pure helpers), `src/middleware.ts` (new — CSP/CSRF/session rotation), `src/pages/api/*` (routes updated to enforce CSRF + validation), `migrations/*` (three new schema migrations). Dev tooling: ESLint + Prettier + Vitest. SEO: `@astrojs/rss` (already installed), `@astrojs/sitemap` (new), static `robots.txt`.

**Tech Stack:** Astro 4, TypeScript, Cloudflare D1, Web Crypto API, Marked, `isomorphic-dompurify` (new), Vitest (new), `@astrojs/sitemap` (new), ESLint/Prettier (new).

**Spec:** [docs/superpowers/specs/2026-04-20-blog-hardening-and-cleanup-design.md](../specs/2026-04-20-blog-hardening-and-cleanup-design.md)

---

## File map

**New files**
- `migrations/002_drafts_replace_private.sql` — replace `is_private`/`private_password` with `status`
- `migrations/002_drafts_replace_private.down.sql` — rollback
- `migrations/003_sessions_csrf.sql` — add `csrf_token` column to sessions
- `migrations/004_cascade_deletes.sql` — add `ON DELETE CASCADE` to `posts.user_id` and `sessions.user_id`
- `src/middleware.ts` — session load/rotate, CSRF check, CSP header, expose `Astro.locals`
- `src/lib/markdown.ts` — sanitized markdown → HTML
- `src/lib/validation.ts` — input length + URL protocol checks
- `src/lib/__tests__/auth.test.ts`
- `src/lib/__tests__/db.test.ts`
- `src/lib/__tests__/validation.test.ts`
- `src/lib/__tests__/markdown.test.ts`
- `src/env.d.ts` — declare `App.Locals` shape
- `src/pages/rss.xml.ts` — RSS feed
- `public/robots.txt`
- `.eslintrc.cjs`
- `.prettierrc`
- `.prettierignore`
- `vitest.config.ts`
- `.env.example`

**Modified files**
- `schema.sql` — update to match post-migration shape for fresh installs
- `seed.sql` — remove hardcoded admin row
- `setup-d1.sh` — generate random admin password, print once
- `src/lib/auth.ts` — constant-time compare, session rotation helpers, CSRF token on create, remove debug logging
- `src/lib/db.ts` — replace `isPrivate`/`privatePassword` with `status`, add `getPostsForPublicFeed`, tighten queries
- `src/pages/index.astro` — filter by `status = 'published'`, sanitize markdown previews
- `src/pages/blog/[slug].astro` — filter by status / ownership, sanitize markdown, remove client-side password UI
- `src/pages/admin/login.astro` — add CSRF token to form
- `src/pages/admin/index.astro` — show status badge, remove "private" column
- `src/pages/admin/new.astro` — status dropdown instead of private checkbox, CSRF hidden input
- `src/pages/admin/edit/[id].astro` — status dropdown, CSRF hidden input
- `src/pages/api/login.ts` — CSRF token set on successful login
- `src/pages/api/logout.ts` — CSRF enforcement via middleware
- `src/pages/api/posts/index.ts` — validation, status, CSRF via middleware
- `src/pages/api/posts/[id].ts` — validation, status, CSRF via middleware
- `src/pages/api/auth/google.ts` — no change to flow, keep OAuth state param
- `src/pages/api/auth/google/callback.ts` — issue CSRF token alongside session
- `astro.config.mjs` — add sitemap integration, site URL from env
- `package.json` — add devDeps, new scripts
- `README.md` — remove admin/admin123, document draft model + CSRF + rate-limiting + new scripts + `PUBLIC_SITE_URL`

---

## Tasks

Work proceeds in the order below. Each task ends in a commit so that the history matches the grouped-commits goal.

---

### Task 1: Bootstrap dev tooling (lint, format, tests, type-check)

**Files:**
- Create: `.eslintrc.cjs`
- Create: `.prettierrc`
- Create: `.prettierignore`
- Create: `vitest.config.ts`
- Modify: `package.json`
- Modify: `tsconfig.json` (ensure it extends `astro/tsconfigs/strict`)

- [ ] **Step 1: Install dev dependencies**

Run:
```bash
npm install -D eslint@^8 @typescript-eslint/parser@^7 @typescript-eslint/eslint-plugin@^7 eslint-plugin-astro@^0.31 prettier@^3 prettier-plugin-astro@^0.13 vitest@^1 @vitest/coverage-v8@^1 isomorphic-dompurify@^2 @astrojs/sitemap@^3 @astrojs/check@^0.5
```

Expected: new entries in `package.json` devDependencies. `isomorphic-dompurify` is a runtime dep for markdown sanitization; move it to dependencies in step 2.

- [ ] **Step 2: Move `isomorphic-dompurify` to dependencies**

In `package.json`, cut `"isomorphic-dompurify"` from `devDependencies` and paste it into `dependencies`. Do the same for `@astrojs/sitemap` (runtime integration).

- [ ] **Step 3: Add scripts to `package.json`**

Replace the `"scripts"` block with:

```json
"scripts": {
  "dev": "astro dev",
  "start": "astro dev",
  "build": "astro build",
  "preview": "astro preview",
  "deploy": "astro build && wrangler pages deploy",
  "db:pull": "./sync-db.sh pull",
  "db:push": "./sync-db.sh push",
  "lint": "eslint . --ext .ts,.astro --max-warnings 0",
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "type-check": "astro check",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 4: Write `.eslintrc.cjs`**

```js
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:astro/recommended',
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
  overrides: [
    {
      files: ['*.astro'],
      parser: 'astro-eslint-parser',
      parserOptions: { parser: '@typescript-eslint/parser', extraFileExtensions: ['.astro'] },
    },
    {
      files: ['**/__tests__/**/*.ts', '**/*.test.ts'],
      rules: { 'no-console': 'off' },
    },
  ],
  ignorePatterns: ['dist/', '.astro/', 'node_modules/', '.wrangler/'],
};
```

- [ ] **Step 5: Write `.prettierrc`**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "plugins": ["prettier-plugin-astro"],
  "overrides": [
    { "files": "*.astro", "options": { "parser": "astro" } }
  ]
}
```

- [ ] **Step 6: Write `.prettierignore`**

```
dist/
.astro/
node_modules/
.wrangler/
package-lock.json
migrations/
```

- [ ] **Step 7: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: false,
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/lib/**/*.ts'],
      exclude: ['src/lib/**/__tests__/**'],
    },
  },
});
```

- [ ] **Step 8: Verify `tsconfig.json` extends strict config**

Open `tsconfig.json`. If it doesn't already:

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "baseUrl": ".",
    "types": ["vitest/globals"]
  }
}
```

- [ ] **Step 9: Run tooling smoke checks**

Run:
```bash
npm run format:check
npm run lint
npm run type-check
npm run test
```

Expected:
- `format:check` may fail on existing files — that's OK for this step. If it does, run `npm run format` and stage the reformat as part of this commit.
- `lint` should pass (no lint errors yet since no new code). If the existing codebase produces lint errors, fix trivial ones inline (unused vars, `any`); if non-trivial, record them and proceed.
- `type-check` must pass.
- `test` reports "No test files found" — expected.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json tsconfig.json .eslintrc.cjs .prettierrc .prettierignore vitest.config.ts
git add -u  # pick up any prettier reformat of existing files
git commit -m "chore: add lint, format, test, type-check tooling"
```

---

### Task 2: Add `src/lib/validation.ts` with tests (TDD)

**Files:**
- Create: `src/lib/validation.ts`
- Create: `src/lib/__tests__/validation.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/lib/__tests__/validation.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  LIMITS,
  validateLength,
  validateHttpsUrl,
  ValidationError,
} from '../validation';

describe('validateLength', () => {
  it('accepts strings within the limit', () => {
    expect(() => validateLength('title', 'hello', LIMITS.title)).not.toThrow();
  });

  it('accepts strings at the limit boundary', () => {
    const atLimit = 'a'.repeat(LIMITS.title);
    expect(() => validateLength('title', atLimit, LIMITS.title)).not.toThrow();
  });

  it('throws ValidationError when over the limit', () => {
    const over = 'a'.repeat(LIMITS.title + 1);
    expect(() => validateLength('title', over, LIMITS.title)).toThrow(ValidationError);
  });

  it('throws when value is not a string', () => {
    expect(() => validateLength('title', 123 as unknown as string, LIMITS.title)).toThrow(
      ValidationError,
    );
  });
});

describe('validateHttpsUrl', () => {
  it('accepts https URLs', () => {
    expect(() => validateHttpsUrl('hero', 'https://example.com/img.png')).not.toThrow();
  });

  it('accepts empty / null / undefined', () => {
    expect(() => validateHttpsUrl('hero', '')).not.toThrow();
    expect(() => validateHttpsUrl('hero', null)).not.toThrow();
    expect(() => validateHttpsUrl('hero', undefined)).not.toThrow();
  });

  it('rejects http:', () => {
    expect(() => validateHttpsUrl('hero', 'http://example.com/img.png')).toThrow(ValidationError);
  });

  it('rejects javascript:', () => {
    expect(() => validateHttpsUrl('hero', 'javascript:alert(1)')).toThrow(ValidationError);
  });

  it('rejects data:', () => {
    expect(() => validateHttpsUrl('hero', 'data:image/png;base64,AAAA')).toThrow(ValidationError);
  });

  it('rejects malformed URLs', () => {
    expect(() => validateHttpsUrl('hero', 'not a url')).toThrow(ValidationError);
  });
});

describe('LIMITS', () => {
  it('exposes the documented limits', () => {
    expect(LIMITS.title).toBe(200);
    expect(LIMITS.description).toBe(500);
    expect(LIMITS.content).toBe(100_000);
    expect(LIMITS.username).toBe(50);
  });
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `npm test`
Expected: failures with "Cannot find module '../validation'" or similar.

- [ ] **Step 3: Write `src/lib/validation.ts`**

```ts
export const LIMITS = {
  title: 200,
  description: 500,
  content: 100_000,
  username: 50,
} as const;

export class ValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validateLength(field: string, value: unknown, max: number): void {
  if (typeof value !== 'string') {
    throw new ValidationError(field, `${field} must be a string`);
  }
  if (value.length > max) {
    throw new ValidationError(field, `${field} exceeds max length of ${max}`);
  }
}

export function validateHttpsUrl(field: string, value: string | null | undefined): void {
  if (value === null || value === undefined || value === '') return;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ValidationError(field, `${field} is not a valid URL`);
  }
  if (parsed.protocol !== 'https:') {
    throw new ValidationError(field, `${field} must use https://`);
  }
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `npm test`
Expected: all validation tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validation.ts src/lib/__tests__/validation.test.ts
git commit -m "feat: add input length and https URL validators with tests"
```

---

### Task 3: Add `src/lib/markdown.ts` with tests (TDD)

**Files:**
- Create: `src/lib/markdown.ts`
- Create: `src/lib/__tests__/markdown.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/lib/__tests__/markdown.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../markdown';

describe('renderMarkdown', () => {
  it('renders basic markdown', () => {
    const html = renderMarkdown('# Hello\n\nWorld');
    expect(html).toContain('<h1');
    expect(html).toContain('Hello');
    expect(html).toContain('<p>World</p>');
  });

  it('strips <script> tags', () => {
    const html = renderMarkdown('ok<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('alert(1)');
  });

  it('strips inline event handlers', () => {
    const html = renderMarkdown('<img src="x" onerror="alert(1)">');
    expect(html).not.toContain('onerror');
    expect(html.toLowerCase()).not.toContain('alert(1)');
  });

  it('strips javascript: hrefs', () => {
    const html = renderMarkdown('[x](javascript:alert(1))');
    expect(html.toLowerCase()).not.toContain('javascript:');
  });

  it('preserves allowed formatting', () => {
    const html = renderMarkdown('**bold** and _italic_ and `code`');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('<code>code</code>');
  });

  it('preserves https image tags', () => {
    const html = renderMarkdown('![alt](https://example.com/x.png)');
    expect(html).toContain('<img');
    expect(html).toContain('https://example.com/x.png');
    expect(html).toContain('alt="alt"');
  });

  it('returns empty string for empty input', () => {
    expect(renderMarkdown('')).toBe('');
  });
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `npm test`
Expected: failures importing `../markdown`.

- [ ] **Step 3: Write `src/lib/markdown.ts`**

```ts
import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_TAGS = [
  'h1','h2','h3','h4','h5','h6',
  'p','ul','ol','li','code','pre',
  'blockquote','a','img','strong','em',
  'hr','br','span','del','table','thead','tbody','tr','th','td',
];

const ALLOWED_ATTR = ['href','src','alt','title','class'];

export function renderMarkdown(src: string): string {
  if (!src) return '';
  const html = marked.parse(src, { gfm: true, breaks: true, async: false }) as string;
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR });
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `npm test`
Expected: all markdown tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/markdown.ts src/lib/__tests__/markdown.test.ts
git commit -m "feat: add sanitized markdown renderer with tests"
```

---

### Task 4: Harden `auth.ts` — constant-time compare, session rotation, CSRF token, remove debug logging

**Files:**
- Modify: `src/lib/auth.ts`
- Create: `src/lib/__tests__/auth.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/lib/__tests__/auth.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  constantTimeEqual,
  generateCsrfToken,
  isAdmin,
  canModifyPost,
  canViewAllPosts,
  type User,
} from '../auth';

const admin: User = { id: 1, username: 'admin', role: 'admin' };
const alice: User = { id: 2, username: 'alice', role: 'user' };
const bob:   User = { id: 3, username: 'bob',   role: 'user' };

describe('constantTimeEqual', () => {
  it('returns true for identical buffers', () => {
    const a = new Uint8Array([1, 2, 3, 4]);
    const b = new Uint8Array([1, 2, 3, 4]);
    expect(constantTimeEqual(a, b)).toBe(true);
  });

  it('returns false for different-length buffers', () => {
    const a = new Uint8Array([1, 2, 3]);
    const b = new Uint8Array([1, 2, 3, 4]);
    expect(constantTimeEqual(a, b)).toBe(false);
  });

  it('returns false when any byte differs', () => {
    const a = new Uint8Array([1, 2, 3, 4]);
    const b = new Uint8Array([1, 2, 3, 5]);
    expect(constantTimeEqual(a, b)).toBe(false);
  });
});

describe('hashPassword / verifyPassword round-trip', () => {
  it('verifies a correct password', async () => {
    const hash = await hashPassword('s3cret!');
    expect(await verifyPassword('s3cret!', hash)).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('s3cret!');
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('rejects a malformed hash', async () => {
    expect(await verifyPassword('anything', 'not-a-hash')).toBe(false);
  });

  it('produces distinct hashes per call (random salt)', async () => {
    const a = await hashPassword('same');
    const b = await hashPassword('same');
    expect(a).not.toBe(b);
    expect(await verifyPassword('same', a)).toBe(true);
    expect(await verifyPassword('same', b)).toBe(true);
  });
});

describe('generateCsrfToken', () => {
  it('returns a 64-char hex string', () => {
    const t = generateCsrfToken();
    expect(t).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns unique values', () => {
    expect(generateCsrfToken()).not.toBe(generateCsrfToken());
  });
});

describe('authorization helpers', () => {
  it('isAdmin reflects role', () => {
    expect(isAdmin(admin)).toBe(true);
    expect(isAdmin(alice)).toBe(false);
  });

  it('canViewAllPosts only for admin', () => {
    expect(canViewAllPosts(admin)).toBe(true);
    expect(canViewAllPosts(alice)).toBe(false);
  });

  it('canModifyPost: admin can always', () => {
    expect(canModifyPost(admin, alice.id)).toBe(true);
    expect(canModifyPost(admin, null)).toBe(true);
  });

  it('canModifyPost: user only for their own posts', () => {
    expect(canModifyPost(alice, alice.id)).toBe(true);
    expect(canModifyPost(alice, bob.id)).toBe(false);
    expect(canModifyPost(alice, null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `npm test`
Expected: failures — `constantTimeEqual` and `generateCsrfToken` are not exported yet.

- [ ] **Step 3: Modify `src/lib/auth.ts` — add `constantTimeEqual` and use it in `verifyPassword`**

Replace `verifyPassword` and add the helper. Show the full new region (from `bufferToHex` through end of `verifyPassword`):

```ts
// Convert ArrayBuffer to hex string
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Convert hex string to Uint8Array
function hexToBytes(hex: string): Uint8Array {
  const match = hex.match(/.{2}/g);
  if (!match) return new Uint8Array();
  return new Uint8Array(match.map(byte => parseInt(byte, 16)));
}

// Constant-time byte compare. Returns true iff a and b are identical.
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
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
    ['deriveBits'],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    256,
  );

  const saltHex = bufferToHex(salt);
  const hashHex = bufferToHex(derivedBits);
  return `${iterations}$${saltHex}$${hashHex}`;
}

// Verify password against hash
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
```

Note: remove the `console.error('Password verification error:', error)` in the catch and the whole `[AUTH] ...` logging block in `authenticateUser` (see step 5).

- [ ] **Step 4: Add `generateCsrfToken` and session rotation helpers**

Add just above `createSession`:

```ts
// Generate a CSRF token (32 random bytes → hex)
export function generateCsrfToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

export const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const SESSION_ROTATE_AFTER_MS = 60 * 60 * 1000; // 1 hour
```

Replace `createSession` with:

```ts
export interface SessionWithCsrf {
  id: string;
  csrfToken: string;
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
```

Replace `Session` interface and `getSession` so CSRF and `createdAt` are included:

```ts
export interface Session {
  id: string;
  userId: number;
  csrfToken: string;
  createdAt: Date;
  expiresAt: Date;
}

export async function getSession(db: D1Database, sessionId: string): Promise<Session | null> {
  const result = await db
    .prepare(
      `SELECT id, user_id as userId, csrf_token as csrfToken,
              created_at as createdAt, expires_at as expiresAt
         FROM sessions WHERE id = ?`,
    )
    .bind(sessionId)
    .first<{ id: string; userId: number; csrfToken: string; createdAt: string; expiresAt: string }>();

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

// Rotate a session if older than SESSION_ROTATE_AFTER_MS.
// Returns the (possibly new) session, or null if the old one is invalid.
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
```

- [ ] **Step 5: Remove debug logging from `authenticateUser`**

Replace the existing `authenticateUser` body:

```ts
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
```

- [ ] **Step 6: Run tests and verify they pass**

Run: `npm test`
Expected: all auth tests pass. If `type-check` breaks at any caller of `createSession` (was `Promise<string>`, now `Promise<SessionWithCsrf>`), leave those errors — they are fixed in Task 8 (API routes) and Task 7 (middleware).

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth.ts src/lib/__tests__/auth.test.ts
git commit -m "feat(auth): constant-time verify, CSRF tokens, session rotation, remove debug logs"
```

---

### Task 5: Draft/published schema migration and `db.ts` updates

**Files:**
- Create: `migrations/002_drafts_replace_private.sql`
- Create: `migrations/002_drafts_replace_private.down.sql`
- Modify: `schema.sql`
- Modify: `src/lib/db.ts`
- Modify: `src/lib/__tests__/db.test.ts` (new file — see step 5)

- [ ] **Step 1: Write `migrations/002_drafts_replace_private.sql`**

Uses the table-rebuild pattern (matches the style of `001_add_oauth_support.sql`).

```sql
-- Replace is_private / private_password with status ('draft' | 'published')
-- Existing private posts become drafts (author/admin can still see them).

CREATE TABLE posts_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft', 'published')),
  hero_image TEXT,
  user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

INSERT INTO posts_new (id, title, slug, description, content, status, hero_image,
                       user_id, created_at, updated_at)
SELECT id, title, slug, description, content,
       CASE WHEN is_private = 1 THEN 'draft' ELSE 'published' END,
       hero_image, user_id, created_at, updated_at
FROM posts;

DROP TABLE posts;
ALTER TABLE posts_new RENAME TO posts;

CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);
```

- [ ] **Step 2: Write `migrations/002_drafts_replace_private.down.sql`**

```sql
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
```

- [ ] **Step 3: Update `schema.sql` for fresh installs**

Open `schema.sql`. Replace the `CREATE TABLE posts (...)` block with the post-migration shape:

```sql
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft', 'published')),
  hero_image TEXT,
  user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);
```

(If schema.sql already defined `is_private`/`private_password` columns, remove them. If it had different index names, keep this file consistent with the migration.)

- [ ] **Step 4: Update `src/lib/db.ts` — `Post` + `PostInput` + queries**

Replace the `Post` and `PostInput` interfaces at the top of `src/lib/db.ts`:

```ts
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
```

Replace every query function in `src/lib/db.ts`. The pattern: drop `is_private as isPrivate, private_password as privatePassword`, drop the boolean-cast mapping, add `status`. Full replacements:

```ts
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

// Unicode-aware slug generator
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

// Generate a collision-free slug by appending -2, -3, ...
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
```

Note: the old name `getPublicPosts` was renamed to `getPublishedPosts`. Task 9 updates `index.astro` to call the new name.

- [ ] **Step 5: Write `src/lib/__tests__/db.test.ts` (pure functions only)**

```ts
import { describe, it, expect, vi } from 'vitest';
import { generateSlug, uniqueSlug, slugExists } from '../db';

describe('generateSlug', () => {
  it('lowercases', () => {
    expect(generateSlug('Hello World')).toBe('hello-world');
  });

  it('collapses non-alphanumerics into one hyphen', () => {
    expect(generateSlug('  foo --- bar  ')).toBe('foo-bar');
  });

  it('strips leading and trailing hyphens', () => {
    expect(generateSlug('!!!hello!!!')).toBe('hello');
  });

  it('transliterates unicode via NFKD', () => {
    expect(generateSlug('Café résumé')).toBe('cafe-resume');
  });

  it('returns "post" for empty / non-alphanumeric-only input', () => {
    expect(generateSlug('')).toBe('post');
    expect(generateSlug('!!!')).toBe('post');
  });
});

describe('uniqueSlug', () => {
  function makeDbReturning(existing: string[]) {
    return {
      prepare: vi.fn((_sql: string) => ({
        bind: (...params: unknown[]) => ({
          first: async () => (existing.includes(params[0] as string) ? { '1': 1 } : null),
        }),
      })),
    } as unknown as Parameters<typeof slugExists>[0];
  }

  it('returns base when no collision', async () => {
    expect(await uniqueSlug(makeDbReturning([]), 'foo')).toBe('foo');
  });

  it('appends -2 on first collision', async () => {
    expect(await uniqueSlug(makeDbReturning(['foo']), 'foo')).toBe('foo-2');
  });

  it('appends -3 when -2 also taken', async () => {
    expect(await uniqueSlug(makeDbReturning(['foo', 'foo-2']), 'foo')).toBe('foo-3');
  });
});
```

- [ ] **Step 6: Run tests and verify they pass**

Run: `npm test`
Expected: auth + validation + markdown + db tests all pass. Type-check may still fail because API routes still reference the old `isPrivate` shape — fixed in Task 8.

- [ ] **Step 7: Apply migration locally**

Run:
```bash
wrangler d1 execute blog-db --local --file=./migrations/002_drafts_replace_private.sql
```

Expected: success. If local DB is empty, the `INSERT ... SELECT` is a no-op; that's fine.

- [ ] **Step 8: Commit**

```bash
git add migrations/002_drafts_replace_private.sql migrations/002_drafts_replace_private.down.sql schema.sql src/lib/db.ts src/lib/__tests__/db.test.ts
git commit -m "feat(posts): replace private posts with draft/published status"
```

---

### Task 6: Sessions CSRF column + cascade deletes migrations

**Files:**
- Create: `migrations/003_sessions_csrf.sql`
- Create: `migrations/004_cascade_deletes.sql`
- Modify: `schema.sql`

- [ ] **Step 1: Write `migrations/003_sessions_csrf.sql`**

```sql
-- Add csrf_token and created_at to sessions (via table rebuild for SQLite).

CREATE TABLE sessions_new (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  csrf_token TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Migrate existing sessions with a throwaway csrf_token (they'll have to re-login
-- anyway because we're also shortening TTL to 24h). Use lower(hex(randomblob(32))).
INSERT INTO sessions_new (id, user_id, csrf_token, created_at, expires_at)
SELECT id, user_id,
       lower(hex(randomblob(32))),
       COALESCE(created_at, CURRENT_TIMESTAMP),
       expires_at
FROM sessions;

DROP TABLE sessions;
ALTER TABLE sessions_new RENAME TO sessions;

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
```

- [ ] **Step 2: Write `migrations/004_cascade_deletes.sql`**

```sql
-- Add ON DELETE CASCADE to posts.user_id and sessions.user_id.

-- posts
CREATE TABLE posts_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft', 'published')),
  hero_image TEXT,
  user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO posts_new SELECT * FROM posts;
DROP TABLE posts;
ALTER TABLE posts_new RENAME TO posts;

CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);

-- sessions
CREATE TABLE sessions_new (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  csrf_token TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO sessions_new SELECT * FROM sessions;
DROP TABLE sessions;
ALTER TABLE sessions_new RENAME TO sessions;

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
```

- [ ] **Step 3: Update `schema.sql` sessions table and foreign keys**

Replace the `CREATE TABLE sessions (...)` in `schema.sql` with:

```sql
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  csrf_token TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
```

Schema for posts was updated in Task 5 step 3 with the cascade already in place — verify it still reads `ON DELETE CASCADE`.

- [ ] **Step 4: Apply migrations locally**

Run:
```bash
wrangler d1 execute blog-db --local --file=./migrations/003_sessions_csrf.sql
wrangler d1 execute blog-db --local --file=./migrations/004_cascade_deletes.sql
```

Expected: both succeed.

- [ ] **Step 5: Commit**

```bash
git add migrations/003_sessions_csrf.sql migrations/004_cascade_deletes.sql schema.sql
git commit -m "feat(db): add csrf_token to sessions, cascade delete posts/sessions on user delete"
```

---

### Task 7: Middleware — session load, rotation, CSRF, CSP

**Files:**
- Create: `src/middleware.ts`
- Create: `src/env.d.ts` (if doesn't exist, otherwise modify)

- [ ] **Step 1: Write `src/env.d.ts`**

```ts
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    user: import('./lib/auth').User | null;
    csrfToken: string | null;
    runtime: {
      env: {
        DB: import('@cloudflare/workers-types').D1Database;
        GOOGLE_CLIENT_ID?: string;
        GOOGLE_CLIENT_SECRET?: string;
        PUBLIC_SITE_URL?: string;
      };
    };
  }
}
```

If a `src/env.d.ts` already exists, merge — don't clobber the `runtime` typing the project already depends on.

- [ ] **Step 2: Write `src/middleware.ts`**

```ts
import { defineMiddleware } from 'astro:middleware';
import {
  getUserBySession,
  getSession,
  rotateSessionIfStale,
  SESSION_TTL_MS,
} from './lib/auth';

const CSP = [
  "default-src 'self'",
  "img-src 'self' https: data:",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join('; ');

// Non-GET requests to these paths do NOT require CSRF (they have their own protection).
const CSRF_EXEMPT_PREFIXES = ['/api/auth/google', '/api/login'];

function isCsrfExempt(pathname: string): boolean {
  return CSRF_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p));
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { cookies, request, locals, url } = context;
  const db = locals.runtime.env.DB;

  locals.user = null;
  locals.csrfToken = null;

  const sessionId = cookies.get('session')?.value ?? null;
  if (sessionId) {
    const session = await getSession(db, sessionId);
    if (session) {
      const user = await getUserBySession(db, session.id);
      if (user) {
        const rotated = await rotateSessionIfStale(db, session);
        locals.user = user;
        locals.csrfToken = rotated.csrfToken;

        if (rotated.id !== session.id) {
          cookies.set('session', rotated.id, {
            path: '/',
            httpOnly: true,
            secure: import.meta.env.PROD,
            sameSite: 'lax',
            maxAge: Math.floor(SESSION_TTL_MS / 1000),
          });
        }
      }
    }
  }

  // CSRF check: non-GET requests to /api/* must carry a matching CSRF token
  // (except exempt prefixes). Use X-CSRF-Token header or _csrf form field.
  if (url.pathname.startsWith('/api/') && request.method !== 'GET') {
    if (!isCsrfExempt(url.pathname)) {
      if (!locals.user || !locals.csrfToken) {
        return new Response('Unauthorized', { status: 401 });
      }
      const headerToken = request.headers.get('x-csrf-token');
      let formToken: string | null = null;
      if (!headerToken) {
        const ct = request.headers.get('content-type') ?? '';
        if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
          const clone = request.clone();
          const form = await clone.formData();
          formToken = typeof form.get('_csrf') === 'string' ? (form.get('_csrf') as string) : null;
        }
      }
      const provided = headerToken ?? formToken;
      if (provided !== locals.csrfToken) {
        return new Response('Forbidden (CSRF)', { status: 403 });
      }
    }
  }

  const response = await next();
  response.headers.set('Content-Security-Policy', CSP);
  return response;
});
```

- [ ] **Step 3: Register middleware (no change needed)**

Astro auto-loads `src/middleware.ts`. Verify `astro.config.mjs` has no explicit middleware setting that would override it. If it does, remove that override.

- [ ] **Step 4: Run type-check**

Run: `npm run type-check`
Expected: passes for middleware. API routes may still fail — fixed in Task 8.

- [ ] **Step 5: Commit**

```bash
git add src/middleware.ts src/env.d.ts
git commit -m "feat(middleware): session rotation, CSRF enforcement, CSP header"
```

---

### Task 8: Update API routes for CSRF, validation, status

**Files:**
- Modify: `src/pages/api/login.ts`
- Modify: `src/pages/api/logout.ts`
- Modify: `src/pages/api/posts/index.ts`
- Modify: `src/pages/api/posts/[id].ts`
- Modify: `src/pages/api/auth/google/callback.ts`

- [ ] **Step 1: Read current API routes**

Run:
```bash
cat src/pages/api/login.ts src/pages/api/logout.ts src/pages/api/posts/index.ts src/pages/api/posts/\[id\].ts src/pages/api/auth/google/callback.ts
```

Capture the current logic (ownership checks, response shapes). We keep existing behavior and add CSRF/validation/status on top.

- [ ] **Step 2: Update `src/pages/api/login.ts`**

The login endpoint does NOT require CSRF (user has no session yet). After successful `authenticateUser`, call the new `createSession(db, userId)` which returns `{ id, csrfToken }`. Set the cookie with the new TTL (`SESSION_TTL_MS / 1000` seconds):

```ts
import type { APIRoute } from 'astro';
import { authenticateUser, createSession, SESSION_TTL_MS } from '../../lib/auth';
import { LIMITS, validateLength, ValidationError } from '../../lib/validation';

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const db = locals.runtime.env.DB;
  try {
    const body = (await request.json()) as { username?: unknown; password?: unknown };
    validateLength('username', body.username, LIMITS.username);
    validateLength('password', body.password, 200);

    const user = await authenticateUser(db, body.username as string, body.password as string);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    }

    const session = await createSession(db, user.id);
    cookies.set('session', session.id, {
      path: '/',
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
    });

    return new Response(
      JSON.stringify({ ok: true, user: { id: user.id, username: user.username, role: user.role } }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  } catch (err) {
    if (err instanceof ValidationError) {
      return new Response(JSON.stringify({ error: err.message, field: err.field }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
};
```

- [ ] **Step 3: Update `src/pages/api/logout.ts`**

Middleware already enforces CSRF on `/api/logout` (non-GET, non-exempt). Keep logic simple:

```ts
import type { APIRoute } from 'astro';
import { deleteSession } from '../../lib/auth';

export const POST: APIRoute = async ({ cookies, locals }) => {
  const db = locals.runtime.env.DB;
  const sessionId = cookies.get('session')?.value;
  if (sessionId) await deleteSession(db, sessionId);
  cookies.delete('session', { path: '/' });
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};
```

- [ ] **Step 4: Update `src/pages/api/posts/index.ts`**

Switch to `status`, validate inputs, use `uniqueSlug`. CSRF enforced by middleware:

```ts
import type { APIRoute } from 'astro';
import {
  createPost,
  generateSlug,
  uniqueSlug,
  getAllPosts,
  getPostsByUser,
  type PostStatus,
} from '../../../lib/db';
import { canViewAllPosts } from '../../../lib/auth';
import { LIMITS, validateLength, validateHttpsUrl, ValidationError } from '../../../lib/validation';

export const GET: APIRoute = async ({ locals }) => {
  const db = locals.runtime.env.DB;
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  const posts = canViewAllPosts(user) ? await getAllPosts(db) : await getPostsByUser(db, user.id);
  return new Response(JSON.stringify(posts), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request, locals }) => {
  const db = locals.runtime.env.DB;
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });

  try {
    const body = (await request.json()) as {
      title?: unknown;
      description?: unknown;
      content?: unknown;
      status?: unknown;
      heroImage?: unknown;
    };

    validateLength('title', body.title, LIMITS.title);
    validateLength('description', body.description, LIMITS.description);
    validateLength('content', body.content, LIMITS.content);

    const status: PostStatus = body.status === 'published' ? 'published' : 'draft';
    const heroImage = typeof body.heroImage === 'string' && body.heroImage ? body.heroImage : null;
    validateHttpsUrl('heroImage', heroImage);

    const baseSlug = generateSlug(body.title as string);
    const slug = await uniqueSlug(db, baseSlug);

    const created = await createPost(db, {
      title: body.title as string,
      slug,
      description: body.description as string,
      content: body.content as string,
      status,
      heroImage,
      userId: user.id,
    });
    return new Response(JSON.stringify(created), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      return new Response(JSON.stringify({ error: err.message, field: err.field }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
};
```

- [ ] **Step 5: Update `src/pages/api/posts/[id].ts`**

```ts
import type { APIRoute } from 'astro';
import {
  getPostById,
  updatePost,
  deletePost,
  generateSlug,
  uniqueSlug,
  type PostStatus,
} from '../../../lib/db';
import { canModifyPost } from '../../../lib/auth';
import { LIMITS, validateLength, validateHttpsUrl, ValidationError } from '../../../lib/validation';

function parseId(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export const GET: APIRoute = async ({ params, locals }) => {
  const db = locals.runtime.env.DB;
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  const id = parseId(params.id);
  if (id === null) return new Response('Not found', { status: 404 });
  const post = await getPostById(db, id);
  if (!post) return new Response('Not found', { status: 404 });
  if (!canModifyPost(user, post.userId)) return new Response('Forbidden', { status: 403 });
  return new Response(JSON.stringify(post), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};

export const PUT: APIRoute = async ({ params, request, locals }) => {
  const db = locals.runtime.env.DB;
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  const id = parseId(params.id);
  if (id === null) return new Response('Not found', { status: 404 });

  const existing = await getPostById(db, id);
  if (!existing) return new Response('Not found', { status: 404 });
  if (!canModifyPost(user, existing.userId)) return new Response('Forbidden', { status: 403 });

  try {
    const body = (await request.json()) as {
      title?: unknown;
      description?: unknown;
      content?: unknown;
      status?: unknown;
      heroImage?: unknown;
    };

    if (body.title !== undefined) validateLength('title', body.title, LIMITS.title);
    if (body.description !== undefined)
      validateLength('description', body.description, LIMITS.description);
    if (body.content !== undefined) validateLength('content', body.content, LIMITS.content);

    let status: PostStatus | undefined;
    if (body.status !== undefined) {
      status = body.status === 'published' ? 'published' : 'draft';
    }

    let heroImage: string | null | undefined;
    if (body.heroImage !== undefined) {
      heroImage = typeof body.heroImage === 'string' && body.heroImage ? body.heroImage : null;
      validateHttpsUrl('heroImage', heroImage);
    }

    let slug: string | undefined;
    if (body.title !== undefined && body.title !== existing.title) {
      const base = generateSlug(body.title as string);
      slug = await uniqueSlug(db, base, id);
    }

    const updated = await updatePost(db, id, {
      title: body.title as string | undefined,
      slug,
      description: body.description as string | undefined,
      content: body.content as string | undefined,
      status,
      heroImage,
    });
    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      return new Response(JSON.stringify({ error: err.message, field: err.field }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const db = locals.runtime.env.DB;
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  const id = parseId(params.id);
  if (id === null) return new Response('Not found', { status: 404 });
  const existing = await getPostById(db, id);
  if (!existing) return new Response('Not found', { status: 404 });
  if (!canModifyPost(user, existing.userId)) return new Response('Forbidden', { status: 403 });
  await deletePost(db, id);
  return new Response(null, { status: 204 });
};
```

- [ ] **Step 6: Update `src/pages/api/auth/google/callback.ts`**

Find the block that creates a session after OAuth success and swap the `createSession` usage to the new return shape:

```ts
// ...after findOrCreateGoogleUser(user)...
const session = await createSession(db, user.id);
cookies.set('session', session.id, {
  path: '/',
  httpOnly: true,
  secure: import.meta.env.PROD,
  sameSite: 'lax',
  maxAge: Math.floor(SESSION_TTL_MS / 1000),
});
```

Import `SESSION_TTL_MS` alongside `createSession`.

- [ ] **Step 7: Type-check and test**

Run:
```bash
npm run type-check
npm test
```

Expected: both pass.

- [ ] **Step 8: Commit**

```bash
git add src/pages/api/
git commit -m "feat(api): CSRF enforcement, input validation, draft/published status"
```

---

### Task 9: Update admin and blog pages for status model, CSRF tokens, sanitized markdown

**Files:**
- Modify: `src/pages/index.astro`
- Modify: `src/pages/blog/[slug].astro`
- Modify: `src/pages/admin/login.astro`
- Modify: `src/pages/admin/index.astro`
- Modify: `src/pages/admin/new.astro`
- Modify: `src/pages/admin/edit/[id].astro`

- [ ] **Step 1: Update `src/pages/index.astro`**

Replace `getPublicPosts(db)` with `getPublishedPosts(db)`. If the page calls `marked(post.description)` or similar with `set:html`, replace with `renderMarkdown`:

```astro
---
import { getPublishedPosts } from '../lib/db';
import { renderMarkdown } from '../lib/markdown';
import BaseLayout from '../layouts/BaseLayout.astro';

const db = Astro.locals.runtime.env.DB;
const posts = await getPublishedPosts(db);
---

<BaseLayout title="Blog">
  {posts.map((post) => (
    <article>
      <h2><a href={`/blog/${post.slug}`}>{post.title}</a></h2>
      {post.authorUsername && <p class="author">by {post.authorUsername}</p>}
      <div set:html={renderMarkdown(post.description)} />
    </article>
  ))}
</BaseLayout>
```

Preserve the existing class names, markup, and styling from the current file — only change the two data/render call sites.

- [ ] **Step 2: Update `src/pages/blog/[slug].astro`**

Remove the client-side password check entirely. Gate drafts server-side:

```astro
---
import { getPostBySlug } from '../../lib/db';
import { renderMarkdown } from '../../lib/markdown';
import BaseLayout from '../../layouts/BaseLayout.astro';

const db = Astro.locals.runtime.env.DB;
const user = Astro.locals.user;
const { slug } = Astro.params;

const post = slug ? await getPostBySlug(db, slug) : null;

// 404 if missing, or if draft and viewer isn't author/admin.
const canSee =
  post &&
  (post.status === 'published' || (user && (user.role === 'admin' || user.id === post.userId)));

if (!canSee) {
  return new Response('Not found', { status: 404 });
}

const html = renderMarkdown(post!.content);
---

<BaseLayout title={post!.title}>
  {post!.heroImage && <img src={post!.heroImage} alt="" class="hero" />}
  <h1>{post!.title}</h1>
  {post!.authorUsername && <p class="author">by {post!.authorUsername}</p>}
  <article set:html={html} />
</BaseLayout>
```

Delete any client-side `<script>` block that compared a password. Delete any CSS for the now-nonexistent password form.

- [ ] **Step 3: Update `src/pages/admin/login.astro`**

The login form posts to `/api/login` which is CSRF-exempt, but the page itself doesn't need CSRF. Just make sure the Google login button links to `/api/auth/google` unchanged. No edits required unless the page currently references the private-post feature.

- [ ] **Step 4: Update `src/pages/admin/index.astro`**

Replace any "Private: Yes/No" column with a "Status" column showing the `status` badge. Use the existing query paths via `Astro.locals.user`. Embed the CSRF token into any delete form/button:

```astro
---
import { getAllPosts, getPostsByUser } from '../../lib/db';
import { canViewAllPosts } from '../../lib/auth';
import BaseLayout from '../../layouts/BaseLayout.astro';

const user = Astro.locals.user;
if (!user) return Astro.redirect('/admin/login');

const db = Astro.locals.runtime.env.DB;
const csrfToken = Astro.locals.csrfToken!;
const posts = canViewAllPosts(user) ? await getAllPosts(db) : await getPostsByUser(db, user.id);
---

<BaseLayout title="Admin">
  <meta name="csrf-token" content={csrfToken} />
  <!-- existing table markup, replacing the private column with: -->
  <!-- <td><span class={`badge ${post.status}`}>{post.status}</span></td> -->
  <!-- existing delete button becomes: -->
  <!-- <button data-id={post.id} class="delete-btn">Delete</button> -->
</BaseLayout>

<script>
  const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
  document.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const id = (e.currentTarget as HTMLElement).dataset.id;
      if (!id || !confirm('Delete this post?')) return;
      const res = await fetch(`/api/posts/${id}`, {
        method: 'DELETE',
        headers: { 'x-csrf-token': token ?? '' },
      });
      if (res.ok) location.reload();
      else alert(await res.text());
    });
  });
</script>
```

Preserve the file's existing styles and structure; only add the meta tag, swap the column, and update the delete handler to include the CSRF header.

- [ ] **Step 5: Update `src/pages/admin/new.astro`**

Replace the "Make this post private" checkbox and password field with a status `<select>`; add a hidden CSRF input; submit via `fetch` carrying `X-CSRF-Token`:

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';

const user = Astro.locals.user;
if (!user) return Astro.redirect('/admin/login');
const csrfToken = Astro.locals.csrfToken!;
---

<BaseLayout title="New post">
  <form id="new-post-form">
    <input type="hidden" name="_csrf" value={csrfToken} />
    <label>Title <input name="title" required maxlength="200" /></label>
    <label>Description <textarea name="description" required maxlength="500"></textarea></label>
    <label>Content <textarea name="content" required maxlength="100000"></textarea></label>
    <label>Hero image URL <input name="heroImage" type="url" pattern="https://.*" /></label>
    <label>Status
      <select name="status">
        <option value="draft" selected>Draft</option>
        <option value="published">Published</option>
      </select>
    </label>
    <button type="submit">Create post</button>
  </form>
</BaseLayout>

<script>
  const form = document.querySelector<HTMLFormElement>('#new-post-form')!;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const csrf = data._csrf as string;
    delete (data as Record<string, unknown>)._csrf;
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify(data),
    });
    if (res.ok) location.href = '/admin';
    else alert(await res.text());
  });
</script>
```

- [ ] **Step 6: Update `src/pages/admin/edit/[id].astro`**

Mirror step 5 — replace private UI with status dropdown, pre-fill from the fetched post, add hidden CSRF, submit PUT with `X-CSRF-Token`. Pseudo-skeleton (use the file's existing layout for styles):

```astro
---
import BaseLayout from '../../../layouts/BaseLayout.astro';
import { getPostById } from '../../../lib/db';
import { canModifyPost } from '../../../lib/auth';

const user = Astro.locals.user;
if (!user) return Astro.redirect('/admin/login');

const id = Number(Astro.params.id);
const db = Astro.locals.runtime.env.DB;
const post = await getPostById(db, id);
if (!post || !canModifyPost(user, post.userId)) return new Response('Not found', { status: 404 });
const csrfToken = Astro.locals.csrfToken!;
---

<BaseLayout title={`Edit: ${post.title}`}>
  <form id="edit-post-form" data-id={post.id}>
    <input type="hidden" name="_csrf" value={csrfToken} />
    <label>Title <input name="title" required maxlength="200" value={post.title} /></label>
    <label>Description <textarea name="description" required maxlength="500">{post.description}</textarea></label>
    <label>Content <textarea name="content" required maxlength="100000">{post.content}</textarea></label>
    <label>Hero image URL <input name="heroImage" type="url" pattern="https://.*" value={post.heroImage ?? ''} /></label>
    <label>Status
      <select name="status">
        <option value="draft" selected={post.status === 'draft'}>Draft</option>
        <option value="published" selected={post.status === 'published'}>Published</option>
      </select>
    </label>
    <button type="submit">Save</button>
  </form>
</BaseLayout>

<script>
  const form = document.querySelector<HTMLFormElement>('#edit-post-form')!;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const csrf = data._csrf as string;
    delete (data as Record<string, unknown>)._csrf;
    const res = await fetch(`/api/posts/${form.dataset.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify(data),
    });
    if (res.ok) location.href = '/admin';
    else alert(await res.text());
  });
</script>
```

- [ ] **Step 7: Type-check + tests + dev smoke test**

Run:
```bash
npm run type-check
npm test
npm run dev &
sleep 3
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4321/
kill %1 2>/dev/null || true
```

Expected: type-check passes, tests pass, `curl` returns 200.

- [ ] **Step 8: Commit**

```bash
git add src/pages/index.astro src/pages/blog/ src/pages/admin/
git commit -m "feat(pages): status dropdown, CSRF tokens in forms, sanitized markdown"
```

---

### Task 10: Remove default admin credentials — setup script + seed

**Files:**
- Modify: `seed.sql`
- Modify: `setup-d1.sh`
- Modify: `README.md` (credentials section only — rest of README updated in Task 13)

- [ ] **Step 1: Update `seed.sql`**

Open `seed.sql`. Remove the `INSERT INTO users (... 'admin', ...)` line. Leave the file otherwise unchanged (it may seed example posts referencing `user_id = 1`; delete those too since there's no admin row anymore, or leave a `-- seed posts here after admin user is created` comment).

- [ ] **Step 2: Update `setup-d1.sh`**

Replace the post-seed step. The script should, after running `schema.sql` + `seed.sql`:

```bash
# Generate a strong admin password
ADMIN_PASSWORD=$(openssl rand -base64 18)
ADMIN_HASH=$(node generate-password.js "$ADMIN_PASSWORD")

# Insert the admin user with the generated hash
wrangler d1 execute blog-db --command \
  "INSERT INTO users (username, password_hash, role) VALUES ('admin', '$ADMIN_HASH', 'admin')"

echo ""
echo "================================================================"
echo "⚠️  Save this password now — it will not be shown again."
echo ""
echo "   Username: admin"
echo "   Password: $ADMIN_PASSWORD"
echo ""
echo "================================================================"
```

Ensure `generate-password.js` prints just the hash to stdout. If it currently prints extra text, modify it to `console.log(hash)` only.

- [ ] **Step 3: Update the credentials section of `README.md`**

Find the block under "Default Login Credentials" and replace with:

```markdown
### Admin credentials

`./setup-d1.sh` generates a random admin password on first run and prints it once:

```
⚠️  Save this password now — it will not be shown again.

   Username: admin
   Password: <generated>
```

Store the password in a password manager. If you lose it, generate a new hash with `node generate-password.js <new-password>` and update the row:

```bash
wrangler d1 execute blog-db --remote \
  --command "UPDATE users SET password_hash = '<new-hash>' WHERE username = 'admin'"
```
```

- [ ] **Step 4: Smoke test locally**

Run:
```bash
# In a scratch context (don't wipe real local DB unless you want to)
./setup-d1.sh  # or copy its new block and run just that
```

Expected: a random password is printed once.

- [ ] **Step 5: Commit**

```bash
git add seed.sql setup-d1.sh generate-password.js README.md
git commit -m "feat(setup): generate random admin password on first run, remove default creds"
```

---

### Task 11: RSS feed, sitemap, robots.txt

**Files:**
- Create: `src/pages/rss.xml.ts`
- Create: `public/robots.txt`
- Create: `.env.example`
- Modify: `astro.config.mjs`
- Modify: `src/layouts/BaseLayout.astro` (add `<link rel="alternate">`)

- [ ] **Step 1: Read `astro.config.mjs`**

Run: `cat astro.config.mjs`

- [ ] **Step 2: Add sitemap integration + site URL to `astro.config.mjs`**

```js
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  site: process.env.PUBLIC_SITE_URL || 'http://localhost:4321',
  integrations: [sitemap()],
});
```

Preserve any other options the existing config had (e.g., image service, vite tweaks).

- [ ] **Step 3: Write `src/pages/rss.xml.ts`**

```ts
import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getPublishedPosts } from '../lib/db';

export const GET: APIRoute = async ({ site, locals }) => {
  const db = locals.runtime.env.DB;
  const posts = (await getPublishedPosts(db)).slice(0, 20);
  return rss({
    title: 'Blog',
    description: 'Latest posts',
    site: site ?? 'http://localhost:4321',
    items: posts.map((p) => ({
      title: p.title,
      link: `/blog/${p.slug}`,
      description: p.description,
      pubDate: new Date(p.createdAt),
    })),
  });
};
```

- [ ] **Step 4: Add RSS `<link>` to `BaseLayout.astro`**

Inside the `<head>` of `src/layouts/BaseLayout.astro`:

```astro
<link rel="alternate" type="application/rss+xml" title="Blog RSS" href="/rss.xml" />
```

- [ ] **Step 5: Write `public/robots.txt`**

```
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/

Sitemap: https://REPLACE-WITH-YOUR-DOMAIN/sitemap-index.xml
```

- [ ] **Step 6: Write `.env.example`**

```
# Public site URL used by sitemap + RSS feed
PUBLIC_SITE_URL=https://yourdomain.example

# Google OAuth (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

- [ ] **Step 7: Verify build output**

Run:
```bash
PUBLIC_SITE_URL=https://example.com npm run build
```

Expected: `dist/` contains `sitemap-index.xml` and `sitemap-0.xml`. No errors.

- [ ] **Step 8: Smoke test RSS in dev**

Run:
```bash
npm run dev &
sleep 3
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4321/rss.xml
kill %1 2>/dev/null || true
```

Expected: 200.

- [ ] **Step 9: Commit**

```bash
git add src/pages/rss.xml.ts public/robots.txt .env.example astro.config.mjs src/layouts/BaseLayout.astro
git commit -m "feat(seo): RSS feed, sitemap integration, robots.txt"
```

---

### Task 12: Final integration checks

**Files:** None (verification only).

- [ ] **Step 1: Run the full toolchain**

```bash
npm run format:check
npm run lint
npm run type-check
npm test
npm run build
```

Expected: all succeed. Fix any lint/type errors inline (shouldn't be any).

- [ ] **Step 2: Manual smoke test in dev**

```bash
npm run dev
```

In a browser:
- `/` loads (home page).
- `/rss.xml` loads.
- `/admin/login` with password fails cleanly with 401 on wrong creds.
- After login: create a draft post → view it at `/blog/<slug>` while logged in → log out → same URL is 404.
- Edit that post to `published` → log out → public URL is 200.
- Try a post with `<script>alert('xss')</script>` in content: page renders literal text, no alert.
- Try hero image URL `javascript:alert(1)`: API returns 400.
- Inspect response headers: `Content-Security-Policy` present.

- [ ] **Step 3: Apply migrations on a throwaway local DB from scratch**

```bash
wrangler d1 execute blog-db --local --command "DROP TABLE IF EXISTS posts; DROP TABLE IF EXISTS sessions; DROP TABLE IF EXISTS users;"
wrangler d1 execute blog-db --local --file=./schema.sql
wrangler d1 execute blog-db --local --file=./seed.sql  # should be no-op for users now
wrangler d1 execute blog-db --local --file=./migrations/001_add_oauth_support.sql || true  # may error if schema already has it
wrangler d1 execute blog-db --local --file=./migrations/002_drafts_replace_private.sql || true
wrangler d1 execute blog-db --local --file=./migrations/003_sessions_csrf.sql || true
wrangler d1 execute blog-db --local --file=./migrations/004_cascade_deletes.sql || true
```

Expected: the schema-based path works without errors. Migrations on top of a fresh schema.sql may be no-ops (expected).

- [ ] **Step 4: Commit any final fixes**

```bash
# only if there are fixes from step 1-3
git add -u
git commit -m "chore: fixups from final integration checks"
```

---

### Task 13: README cleanup

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace the "Features" block**

Update the "Post Management" bullet:

```markdown
- **Post Management**
  - Create, edit, and delete posts via the admin dashboard
  - Draft / Published status — drafts visible only to author (and admins)
  - Author attribution on all posts
  - Sanitized Markdown with hero images
```

Delete the old "Public & private posts with password protection" line.

- [ ] **Step 2: Document the new auth hardening**

Add a section after "Role-Based Access Control":

```markdown
## Session and CSRF

- Sessions expire after 24 hours of inactivity. Active sessions rotate their ID every hour to limit the blast radius of a leaked cookie.
- All non-GET requests to `/api/*` (except `/api/login` and `/api/auth/google*`) must carry a CSRF token. The token is exposed to admin pages as `Astro.locals.csrfToken` and included automatically by the bundled forms.
```

- [ ] **Step 3: Document the Cloudflare rate-limiting rules**

Add before "Troubleshooting":

```markdown
## Rate limiting (production)

Rate limiting is configured in the Cloudflare dashboard, not in the app. Recommended rules for this blog:

| Path | Limit | Action |
|------|-------|--------|
| `/api/login` | 10 requests / minute / IP | Block for 10 minutes |
| `/api/auth/google/callback` | 20 requests / minute / IP | Block for 10 minutes |
| `/api/posts` (POST) | 30 requests / minute / IP | Challenge |

Add these in **Security > WAF > Rate limiting rules** for the production zone.
```

- [ ] **Step 4: Add the new script commands to the table**

Update the commands table:

```markdown
| Command             | Action                                       |
|:--------------------|:---------------------------------------------|
| `npm install`       | Install dependencies                         |
| `npm run dev`       | Start local dev server at `localhost:4321`   |
| `npm run build`     | Build production site to `./dist/`           |
| `npm run preview`   | Preview build locally before deploying       |
| `npm run deploy`    | Build and deploy to Cloudflare Pages         |
| `npm run lint`      | Lint all `.ts` and `.astro` files            |
| `npm run format`    | Format all files with Prettier               |
| `npm run type-check`| Run `astro check`                            |
| `npm test`          | Run Vitest unit tests                        |
| `npm run db:pull`   | Sync remote database to local                |
| `npm run db:push`   | Sync local database to remote (⚠️ overwrites)|
| `./setup-d1.sh`     | Create D1 DB, apply schema, generate admin password |
```

- [ ] **Step 5: Document `PUBLIC_SITE_URL`**

Add to the "First-Time Deployment" environment-variables step:

```markdown
- `PUBLIC_SITE_URL`: Your production URL (e.g. `https://blog.example.com`). Used by RSS + sitemap.
```

And add to `.dev.vars` example:

```
PUBLIC_SITE_URL=http://localhost:4321
```

- [ ] **Step 6: Document robots.txt Sitemap placeholder**

Add a note under the deployment steps:

```markdown
Edit `public/robots.txt` and replace `REPLACE-WITH-YOUR-DOMAIN` with your actual domain before deploying. This only needs to be done once.
```

- [ ] **Step 7: Remove the outdated "Migration Checklist" section or replace it with this pass's migration order**

Replace with:

```markdown
## Migration order (this release)

Before pushing the updated code to production, run migrations on the remote D1 in order:

```bash
wrangler d1 execute blog-db --remote --file=./migrations/002_drafts_replace_private.sql
wrangler d1 execute blog-db --remote --file=./migrations/003_sessions_csrf.sql
wrangler d1 execute blog-db --remote --file=./migrations/004_cascade_deletes.sql
```

Existing sessions are invalidated by migration 003. Users will need to log in again.
```

- [ ] **Step 8: Commit**

```bash
git add README.md
git commit -m "docs: update README for draft/published, CSRF, rate-limiting, new scripts"
```

---

## Deployment (after merging to main)

Not part of the PR's git history — run against production:

1. On `main`, from a local checkout with `wrangler login` done:

```bash
wrangler d1 execute blog-db --remote --file=./migrations/002_drafts_replace_private.sql
wrangler d1 execute blog-db --remote --file=./migrations/003_sessions_csrf.sql
wrangler d1 execute blog-db --remote --file=./migrations/004_cascade_deletes.sql
```

2. Set `PUBLIC_SITE_URL` in Cloudflare Pages environment variables (Production + Preview).
3. Merge the PR → Cloudflare Pages auto-deploys.
4. Add the Cloudflare Rate Limiting rules from the README table.
5. Edit `public/robots.txt` for the production domain (or commit that edit ahead of merge).
6. Verify: `/`, `/rss.xml`, `/sitemap-index.xml`, admin login, draft gating, `<script>` in content is inert, `Content-Security-Policy` header present.
