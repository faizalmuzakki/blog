import type { APIRoute } from 'astro';
import {
  createPost,
  generateSlug,
  slugExists,
  uniqueSlug,
  type PostStatus,
} from '../../../../../../lib/db';
import { getComposeSession, updateComposeSession } from '../../../../../../lib/compose';
import {
  LIMITS,
  ValidationError,
  validateLength,
} from '../../../../../../lib/validation';

function parseId(raw: string | undefined): number | null {
  if (!raw) return null;
  const id = Number.parseInt(raw, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function randomTranslationGroupId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export const POST: APIRoute = async ({ params, request, locals }) => {
  const db = locals.runtime.env.DB;
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });

  const id = parseId(params.id as string | undefined);
  if (id === null) return new Response('Not found', { status: 404 });

  const session = await getComposeSession(db, user.id, id);
  if (!session) return new Response('Not found', { status: 404 });

  const body = (await request.json().catch(() => ({}))) as { status?: unknown };
  const publishStatus: PostStatus = body.status === 'published' ? 'published' : 'draft';

  const drafts = Object.values(session.generatedDrafts);
  if (!drafts.length) {
    return new Response(JSON.stringify({ error: 'No generated drafts to publish' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    for (const d of drafts) {
      validateLength(`drafts.${d.language}.title`, d.title, LIMITS.title);
      validateLength(`drafts.${d.language}.description`, d.description, LIMITS.description);
      validateLength(`drafts.${d.language}.content`, d.content, LIMITS.content);
    }

    const groupId = randomTranslationGroupId();
    const created = [];
    for (const d of drafts) {
      const baseSlug = d.slug ? generateSlug(d.slug) : generateSlug(d.title);
      const slug = (await slugExists(db, baseSlug, d.language))
        ? await uniqueSlug(db, baseSlug, d.language)
        : baseSlug;

      const post = await createPost(db, {
        title: d.title,
        slug,
        language: d.language,
        description: d.description,
        content: d.content,
        status: publishStatus,
        translationGroupId: groupId,
        composeSessionId: session.id,
        userId: user.id,
      });
      created.push(post);
    }

    await updateComposeSession(db, user.id, session.id, { status: 'published' });

    return new Response(JSON.stringify({ ok: true, posts: created, translationGroupId: groupId }), {
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
    const message = err instanceof Error ? err.message : 'Publish failed';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
};
