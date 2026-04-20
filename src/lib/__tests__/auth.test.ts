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
const bob: User = { id: 3, username: 'bob', role: 'user' };

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
