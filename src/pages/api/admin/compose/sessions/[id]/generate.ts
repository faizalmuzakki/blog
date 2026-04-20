import type { APIRoute } from 'astro';
import { composeMany, type ComposeGeneration } from '../../../../../../lib/claude-api';
import { getComposeSession, updateComposeSession } from '../../../../../../lib/compose';
import {
  LIMITS,
  ValidationError,
  validateLanguageArray,
} from '../../../../../../lib/validation';

function parseId(raw: string | undefined): number | null {
  if (!raw) return null;
  const id = Number.parseInt(raw, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export const POST: APIRoute = async ({ params, request, locals }) => {
  const env = locals.runtime.env;
  const db = env.DB;
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });

  const id = parseId(params.id as string | undefined);
  if (id === null) return new Response('Not found', { status: 404 });

  if (!env.CLAUDE_API_URL || !env.CLAUDE_API_SECRET) {
    return new Response(
      JSON.stringify({ error: 'claude-api is not configured (CLAUDE_API_URL/CLAUDE_API_SECRET)' }),
      { status: 503, headers: { 'content-type': 'application/json' } },
    );
  }

  const session = await getComposeSession(db, user.id, id);
  if (!session) return new Response('Not found', { status: 404 });
  if (!session.originalText.trim()) {
    return new Response(JSON.stringify({ error: 'originalText is empty' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
  if (!session.targetLanguages.length) {
    return new Response(JSON.stringify({ error: 'targetLanguages is empty' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  let languages = session.targetLanguages;
  try {
    const body = (await request.json().catch(() => ({}))) as { languages?: unknown };
    if (Array.isArray(body.languages) && body.languages.length) {
      const requested = validateLanguageArray(
        'languages',
        body.languages,
        LIMITS.composeTargetLanguages,
      );
      languages = requested.filter((l) => session.targetLanguages.includes(l));
      if (!languages.length) {
        return new Response(
          JSON.stringify({ error: 'No requested languages are in this session' }),
          { status: 400, headers: { 'content-type': 'application/json' } },
        );
      }
    }
  } catch (err) {
    if (err instanceof ValidationError) {
      return new Response(JSON.stringify({ error: err.message, field: err.field }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw err;
  }

  await updateComposeSession(db, user.id, id, { status: 'generating' });

  try {
    const generations = await composeMany(
      { url: env.CLAUDE_API_URL, secret: env.CLAUDE_API_SECRET },
      session.originalText,
      languages,
      session.sourceLanguage,
    );

    const drafts: Record<string, ComposeGeneration> = { ...session.generatedDrafts };
    for (const g of generations) drafts[g.language] = g;

    const updated = await updateComposeSession(db, user.id, id, {
      generatedDrafts: drafts,
      status: 'generated',
    });

    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    await updateComposeSession(db, user.id, id, { status: 'draft' });
    const message = err instanceof Error ? err.message : 'Generation failed';
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }
};
