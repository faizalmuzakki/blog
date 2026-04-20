import { describe, it, expect, vi } from 'vitest';
import { generateSlug, uniqueSlug } from '../db';

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
    const db = {
      prepare: vi.fn(() => ({
        bind: (...params: unknown[]) => ({
          first: async () => (existing.includes(params[0] as string) ? { '1': 1 } : null),
        }),
      })),
    };
    return db as unknown as import('@cloudflare/workers-types').D1Database;
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
