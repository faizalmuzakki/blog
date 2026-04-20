import type { APIRoute } from 'astro';
import { createComposeSession, listComposeSessions } from '../../../../../lib/compose';
import {
  LIMITS,
  ValidationError,
  validateLanguageArray,
  validateLanguageCode,
  validateLength,
} from '../../../../../lib/validation';

export const GET: APIRoute = async ({ locals }) => {
  const db = locals.runtime.env.DB;
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });

  const sessions = await listComposeSessions(db, user.id);
  return new Response(JSON.stringify(sessions), {
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
      originalText?: unknown;
      sourceLanguage?: unknown;
      targetLanguages?: unknown;
    };

    validateLength('originalText', body.originalText ?? '', LIMITS.composeOriginalText);
    const sourceLanguage = validateLanguageCode('sourceLanguage', body.sourceLanguage ?? 'en');
    const targetLanguages = validateLanguageArray(
      'targetLanguages',
      body.targetLanguages ?? [],
      LIMITS.composeTargetLanguages,
    );

    const session = await createComposeSession(db, user.id, {
      originalText: (body.originalText as string) ?? '',
      sourceLanguage,
      targetLanguages,
    });

    return new Response(JSON.stringify(session), {
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
