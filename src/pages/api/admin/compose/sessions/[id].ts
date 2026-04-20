import type { APIRoute } from 'astro';
import {
  deleteComposeSession,
  getComposeSession,
  updateComposeSession,
} from '../../../../../lib/compose';
import {
  LIMITS,
  ValidationError,
  validateLanguageArray,
  validateLanguageCode,
  validateLength,
} from '../../../../../lib/validation';

function parseId(raw: string | undefined): number | null {
  if (!raw) return null;
  const id = Number.parseInt(raw, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export const GET: APIRoute = async ({ params, locals }) => {
  const db = locals.runtime.env.DB;
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });

  const id = parseId(params.id as string | undefined);
  if (id === null) return new Response('Not found', { status: 404 });

  const session = await getComposeSession(db, user.id, id);
  if (!session) return new Response('Not found', { status: 404 });

  return new Response(JSON.stringify(session), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const db = locals.runtime.env.DB;
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });

  const id = parseId(params.id as string | undefined);
  if (id === null) return new Response('Not found', { status: 404 });

  try {
    const body = (await request.json()) as {
      originalText?: unknown;
      sourceLanguage?: unknown;
      targetLanguages?: unknown;
      generatedDrafts?: unknown;
    };

    const patch: Parameters<typeof updateComposeSession>[3] = {};

    if (body.originalText !== undefined) {
      validateLength('originalText', body.originalText, LIMITS.composeOriginalText);
      patch.originalText = body.originalText as string;
    }
    if (body.sourceLanguage !== undefined) {
      patch.sourceLanguage = validateLanguageCode('sourceLanguage', body.sourceLanguage);
    }
    if (body.targetLanguages !== undefined) {
      patch.targetLanguages = validateLanguageArray(
        'targetLanguages',
        body.targetLanguages,
        LIMITS.composeTargetLanguages,
      );
    }
    if (body.generatedDrafts !== undefined) {
      if (typeof body.generatedDrafts !== 'object' || body.generatedDrafts === null) {
        throw new ValidationError('generatedDrafts', 'generatedDrafts must be an object');
      }
      patch.generatedDrafts = body.generatedDrafts as Record<string, never>;
    }

    const updated = await updateComposeSession(db, user.id, id, patch);
    if (!updated) return new Response('Not found', { status: 404 });

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

  const id = parseId(params.id as string | undefined);
  if (id === null) return new Response('Not found', { status: 404 });

  const ok = await deleteComposeSession(db, user.id, id);
  if (!ok) return new Response('Not found', { status: 404 });

  return new Response(null, { status: 204 });
};
