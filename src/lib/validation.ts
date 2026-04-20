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
