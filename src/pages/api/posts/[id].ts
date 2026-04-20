import type { APIRoute } from 'astro';
import {
  getPostById,
  updatePost,
  deletePost,
  generateSlug,
  uniqueSlug,
  type PostStatus,
} from '../../../lib/db';
import { canModifyPost } from '../../../lib/auth';
import { LIMITS, validateLength, validateHttpsUrl, ValidationError } from '../../../lib/validation';

function parseId(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export const GET: APIRoute = async ({ params, locals }) => {
  const db = locals.runtime.env.DB;
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  const id = parseId(params.id);
  if (id === null) return new Response('Not found', { status: 404 });
  const post = await getPostById(db, id);
  if (!post) return new Response('Not found', { status: 404 });
  if (!canModifyPost(user, post.userId)) return new Response('Forbidden', { status: 403 });
  return new Response(JSON.stringify(post), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};

export const PUT: APIRoute = async ({ params, request, locals }) => {
  const db = locals.runtime.env.DB;
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  const id = parseId(params.id);
  if (id === null) return new Response('Not found', { status: 404 });

  const existing = await getPostById(db, id);
  if (!existing) return new Response('Not found', { status: 404 });
  if (!canModifyPost(user, existing.userId)) return new Response('Forbidden', { status: 403 });

  try {
    const body = (await request.json()) as {
      title?: unknown;
      description?: unknown;
      content?: unknown;
      status?: unknown;
      heroImage?: unknown;
    };

    if (body.title !== undefined) validateLength('title', body.title, LIMITS.title);
    if (body.description !== undefined)
      validateLength('description', body.description, LIMITS.description);
    if (body.content !== undefined) validateLength('content', body.content, LIMITS.content);

    let status: PostStatus | undefined;
    if (body.status !== undefined) {
      status = body.status === 'published' ? 'published' : 'draft';
    }

    let heroImage: string | null | undefined;
    if (body.heroImage !== undefined) {
      heroImage = typeof body.heroImage === 'string' && body.heroImage ? body.heroImage : null;
      validateHttpsUrl('heroImage', heroImage);
    }

    let slug: string | undefined;
    if (body.title !== undefined && body.title !== existing.title) {
      const base = generateSlug(body.title as string);
      slug = await uniqueSlug(db, base, id);
    }

    const updated = await updatePost(db, id, {
      title: body.title as string | undefined,
      slug,
      description: body.description as string | undefined,
      content: body.content as string | undefined,
      status,
      heroImage,
    });
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
  const id = parseId(params.id);
  if (id === null) return new Response('Not found', { status: 404 });
  const existing = await getPostById(db, id);
  if (!existing) return new Response('Not found', { status: 404 });
  if (!canModifyPost(user, existing.userId)) return new Response('Forbidden', { status: 403 });
  await deletePost(db, id);
  return new Response(null, { status: 204 });
};
