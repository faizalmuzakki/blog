import { describe, it, expect } from 'vitest';
import { LIMITS, validateLength, validateHttpsUrl, ValidationError } from '../validation';

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
