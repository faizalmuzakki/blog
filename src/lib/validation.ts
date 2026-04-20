export const LIMITS = {
  title: 200,
  description: 500,
  content: 100_000,
  username: 50,
  composeOriginalText: 20_000,
  composeTargetLanguages: 8,
} as const;

const LANGUAGE_CODE_RE = /^[a-z]{2}(-[A-Z]{2})?$/;

export function validateLanguageCode(field: string, value: unknown): string {
  if (typeof value !== 'string' || !LANGUAGE_CODE_RE.test(value)) {
    throw new ValidationError(field, `${field} must be a language code like "en" or "id-ID"`);
  }
  return value;
}

export function validateLanguageArray(field: string, value: unknown, max: number): string[] {
  if (!Array.isArray(value)) {
    throw new ValidationError(field, `${field} must be an array`);
  }
  if (value.length > max) {
    throw new ValidationError(field, `${field} has more than ${max} entries`);
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of value) {
    const code = validateLanguageCode(field, entry);
    if (!seen.has(code)) {
      seen.add(code);
      out.push(code);
    }
  }
  return out;
}

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
