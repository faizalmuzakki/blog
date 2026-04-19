# Blog Hardening and Cleanup — Design

**Date:** 2026-04-20
**Scope:** One PR with grouped commits. Security fixes, auth hardening, tests, tooling, SEO.
**Repo:** `/Users/mac/Projects/blog` (Astro SSR + Cloudflare Pages + D1)

## Goals

Bring the blog to a solid baseline in one pass: fix real vulnerabilities, harden auth/session handling, add minimal tests and tooling, and publish basic SEO assets (RSS, sitemap, robots). Leave the repo maintainable without introducing bespoke infrastructure.

## Non-goals

- Rich editor, image uploads, comments, tags, search — out of scope.
- Multi-tenancy or per-post ACLs beyond `admin` vs `user`.
- Production CI/CD pipeline (GitHub Actions optional, not included here).
- E2E or integration tests — unit tests only in this pass.

---

## Section 1: Draft/Published model (replaces private posts)

The current "private post" feature embeds the password in page HTML and checks it client-side. It is not a real access control. We replace it with a draft/published workflow.

**Schema migration** (`migrations/002_drafts_replace_private.sql`, table-rebuild pattern for SQLite compatibility):

1. Create `posts_new` with the new `status TEXT NOT NULL DEFAULT 'published'` column and no `is_private` / `private_password` columns.
2. Insert from `posts`, mapping `is_private = 1` → `status = 'draft'`, else `'published'`.
3. Drop `posts`, rename `posts_new` → `posts`, recreate indexes.

Paired down migration (`002_drafts_replace_private.down.sql`) restores the old columns. Password data is not recoverable after rollback — acceptable because the feature was broken.

**Visibility rules:**

- Public pages (`/`, `/blog/[slug]`): `WHERE status = 'published'`.
- Admin dashboard: admins see all posts; regular users see their own (both statuses).
- `/blog/[slug]` for a draft: 404 for anonymous visitors; rendered for the author or any admin.

**UI change:** replace the "Make private" checkbox and password field in [src/pages/admin/new.astro](../../../src/pages/admin/new.astro) and [src/pages/admin/edit/[id].astro](../../../src/pages/admin/edit/[id].astro) with a status dropdown (`Draft` / `Published`). Default on create: `Draft`.

**API:** `POST /api/posts` accepts `status`; defaults to `draft` if omitted. `GET /api/posts` filtering unchanged beyond the column rename.

---

## Section 2: Security-critical fixes

### 2.1 XSS in markdown rendering

[src/pages/blog/[slug].astro:22](../../../src/pages/blog/[slug].astro#L22) and any home-page preview render `marked(content)` output with `set:html`. Marked leaves raw HTML intact, so any post author can inject `<script>` or event handlers.

**Fix:** add `isomorphic-dompurify`. Wrap every `marked()` call:

```ts
// src/lib/markdown.ts
import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

export function renderMarkdown(src: string): string {
  const html = marked.parse(src, { gfm: true, breaks: true });
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['h1','h2','h3','h4','h5','h6','p','ul','ol','li','code','pre',
                   'blockquote','a','img','strong','em','hr','br','span','del'],
    ALLOWED_ATTR: ['href','src','alt','title','class'],
  });
}
```

Replace inline `marked(...)` usage in [src/pages/blog/[slug].astro](../../../src/pages/blog/[slug].astro) and anywhere else it appears.

### 2.2 Content Security Policy

Add `src/middleware.ts` that sets on every response:

```
Content-Security-Policy: default-src 'self';
  img-src 'self' https: data:;
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  object-src 'none';
  base-uri 'self';
  frame-ancestors 'none'
```

`'unsafe-inline'` for styles is a pragmatic compromise — admin pages use inline `<style>` blocks. Can be tightened by extracting styles in a follow-up.

### 2.3 Constant-time password compare

[src/lib/auth.ts:101](../../../src/lib/auth.ts#L101) uses `===` on hex strings, which short-circuits on first mismatch.

**Fix:** compare the raw `Uint8Array` bytes via an XOR accumulator:

```ts
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
```

Unit-tested for equal buffers, different-byte-at-same-length, and length mismatch.

### 2.4 Hero image URL validation

In `POST /api/posts` and `PUT /api/posts/:id`: if `heroImage` is non-empty, `new URL(heroImage)` must succeed and `.protocol` must equal `https:`. Otherwise return 400. Stops `javascript:` and `data:` URLs.

### 2.5 Default credentials removal

- Delete the hardcoded admin row from [seed.sql](../../../seed.sql).
- [setup-d1.sh](../../../setup-d1.sh) generates a password via `openssl rand -base64 18`, hashes it with `generate-password.js`, inserts the admin row via `wrangler d1 execute`, then prints the password once with a clear banner: `⚠️  Save this now — it will not be shown again`.
- README updated: remove `admin/admin123`, document the generated-password flow.

---

## Section 3: Hardening

### 3.1 CSRF protection

- `sessions` table gains `csrf_token TEXT NOT NULL` (migration `003_sessions_csrf.sql`, table-rebuild).
- On login + OAuth callback, generate 32 random bytes → hex and store alongside the session.
- Middleware reads the session, sets `Astro.locals.user` and `Astro.locals.csrfToken`.
- Admin forms embed the token as `<input type="hidden" name="_csrf">`.
- `fetch` calls from admin JS include `X-CSRF-Token: <token>`.
- Middleware rejects non-GET requests to `/api/*` (except `/api/auth/google*`, which use the OAuth `state` param) when the header/body token does not match the session's. Mismatch → 403.

SameSite=Lax cookies already reduce CSRF risk; the token is defense-in-depth.

### 3.2 Session rotation and TTL

- TTL shortened from 7 days → 24 hours.
- On every authenticated request: if session's `created_at` is more than 1 hour old, rotate — generate new session ID + CSRF token, insert new row, delete old row, set new cookie. Sliding-window effect: active users stay logged in, idle sessions expire in 24h.

### 3.3 Cascade delete

Migration `004_cascade_deletes.sql` rebuilds `posts` and `sessions` with `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`. Deleting a user cleans up their posts and sessions.

### 3.4 Slug collision handling

[src/lib/db.ts:234](../../../src/lib/db.ts#L234): `generateSlug` currently does not check for uniqueness. Wrap insertion in a loop:

```ts
async function uniqueSlug(db: D1Database, base: string): Promise<string> {
  let slug = base;
  let n = 2;
  while (await db.prepare('SELECT 1 FROM posts WHERE slug = ?').bind(slug).first()) {
    slug = `${base}-${n++}`;
  }
  return slug;
}
```

### 3.5 Input length limits

At the API layer, reject with 400 if:

- `title` > 200 chars
- `description` > 500 chars
- `content` > 100 000 chars
- `username` > 50 chars

Centralize in `src/lib/validation.ts` so tests and routes share one implementation.

---

## Section 4: Tooling, tests, SEO

### 4.1 Dev tooling

Add to `package.json` devDependencies: `eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, `eslint-plugin-astro`, `prettier`, `prettier-plugin-astro`, `vitest`.

Scripts:

- `lint` → `eslint . --ext .ts,.astro`
- `format` → `prettier --write .`
- `type-check` → `astro check`
- `test` → `vitest run`

Config files: minimal `.eslintrc.cjs` (recommended rulesets, no custom rules), `.prettierrc` (2-space, single-quote, 100-col), `vitest.config.ts`. No pre-commit hooks.

### 4.2 Unit tests (smoke tier)

Directory: `src/lib/__tests__/`. Target ~15 tests, all pure-function (no D1 required).

- `auth.test.ts` — `hashPassword` → `verifyPassword` round-trip; wrong password rejected; length-mismatch rejected; `constantTimeEqual` semantics; `canModifyPost`, `isAdmin`, `canViewAllPosts` for admin/user/anonymous cases.
- `db.test.ts` — `generateSlug` sanitizes unicode, punctuation, collapses whitespace, empty input fallback; `uniqueSlug` appends `-2`, `-3` on collision.
- `validation.test.ts` — length limits reject over-limit inputs, accept boundary values; URL validator rejects `javascript:`, `data:`, `http:`, accepts `https:` and empty.
- `markdown.test.ts` — `renderMarkdown` strips `<script>`, event handlers, `javascript:` hrefs; preserves allowed tags.

### 4.3 RSS feed

`src/pages/rss.xml.ts` using `@astrojs/rss` (already in `package.json`). 20 most recent `status = 'published'` posts, ordered by `created_at DESC`. `<link rel="alternate" type="application/rss+xml">` added to BaseLayout `<head>`.

### 4.4 Sitemap

Install `@astrojs/sitemap`, register in [astro.config.mjs](../../../astro.config.mjs). Site URL comes from `PUBLIC_SITE_URL` env var (set in `.dev.vars` and Cloudflare Pages env), fallback `http://localhost:4321` in dev.

### 4.5 robots.txt

`public/robots.txt`:

```
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/

Sitemap: <PUBLIC_SITE_URL>/sitemap-index.xml
```

Note: `robots.txt` is static, so the sitemap URL uses a placeholder that the user edits once for their domain. Documented in README.

### 4.6 README cleanup

- Remove all `admin/admin123` references.
- Document the new draft/published model (UI dropdown, visibility rules, API).
- Document the Cloudflare Rate Limiting rules to configure in the dashboard:
  - `/api/login`: 10 requests / minute / IP, block for 10 minutes
  - `/api/auth/google/callback`: 20 requests / minute / IP
- Document CSRF token / session rotation behavior for future contributors.
- Document `npm test`, `npm run lint`, `npm run type-check`, `npm run format` commands.
- Document `PUBLIC_SITE_URL` env var and where to set it.

---

## Component summary

| Component | Responsibility | Interface |
|-----------|---------------|-----------|
| `src/middleware.ts` | CSRF check, session rotation, CSP header, expose `locals.user` + `locals.csrfToken` | Astro middleware contract |
| `src/lib/auth.ts` | Password hash/verify (constant-time), session create/rotate/destroy, authorization helpers | Pure async functions |
| `src/lib/db.ts` | D1 queries for users, posts, sessions | Typed async functions |
| `src/lib/markdown.ts` | Sanitized markdown → HTML | `renderMarkdown(src): string` |
| `src/lib/validation.ts` | Input length and URL protocol checks | Pure functions |
| `src/pages/api/posts/*` | CRUD + CSRF + validation + ownership | Astro API routes |
| `src/pages/rss.xml.ts` | RSS feed | Astro endpoint |
| `migrations/002..004` | Schema changes (drafts, CSRF, cascade) | Wrangler SQL files |

Each unit has one clear purpose and is testable without the others (middleware via mocked `locals`; lib via pure functions; routes by composition).

---

## Migration order (deployment)

The new code reads columns (`status`, `csrf_token`) that don't exist yet. Migrations must run **before** the new app reaches production. Cloudflare Pages auto-deploys on push to main, so the safe order is:

1. On a feature branch, run migrations against remote D1 in order:
   - `wrangler d1 execute blog-db --remote --file=./migrations/002_drafts_replace_private.sql`
   - `wrangler d1 execute blog-db --remote --file=./migrations/003_sessions_csrf.sql`
   - `wrangler d1 execute blog-db --remote --file=./migrations/004_cascade_deletes.sql`

   Old columns the new code no longer references (`is_private`, `private_password`) are dropped in step 1 — the *currently deployed* code still reads them, so this is the narrow window where the live site is broken. Mitigation: pick a low-traffic moment; the window is seconds.

2. Set `PUBLIC_SITE_URL` env var in Cloudflare Pages.
3. Merge PR to main → Cloudflare Pages builds and deploys.
4. Configure Cloudflare Rate Limiting rules in the dashboard (documented in README).
5. Edit `public/robots.txt` sitemap URL for production domain (committed in the same PR; verify post-deploy).
6. Verify: public home page loads, draft post is 404 for anonymous, admin login works, create/edit/delete post works, RSS feed resolves, sitemap resolves.

Existing users keep their sessions? **No** — schema change to `sessions` invalidates existing rows. Users re-login. Acceptable for a personal blog; documented.

---

## Success criteria

- All new migrations apply cleanly against a fresh D1 (tested locally first).
- `npm run type-check`, `npm run lint`, `npm test` all pass.
- Manual smoke test: login (pw + OAuth), create draft, view as author, log out → 404, log back in → edit → publish → public sees it, delete post.
- No `admin/admin123` in any committed file.
- Rendering a post containing `<script>alert(1)</script>` in content shows literal text, no execution.
- CSP header present on all responses.
- Rate limiting rules documented in README with exact values.
