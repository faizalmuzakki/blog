import type { APIRoute } from 'astro';
import {
  createPost,
  generateSlug,
  uniqueSlug,
  getAllPosts,
  getPostsByUser,
  type PostStatus,
} from '../../../lib/db';
import { canViewAllPosts } from '../../../lib/auth';
import { LIMITS, validateLength, validateHttpsUrl, ValidationError } from '../../../lib/validation';

export const GET: APIRoute = async ({ locals }) => {
  const db = locals.runtime.env.DB;
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  const posts = canViewAllPosts(user) ? await getAllPosts(db) : await getPostsByUser(db, user.id);
  return new Response(JSON.stringify(posts), {
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
      title?: unknown;
      description?: unknown;
      content?: unknown;
      status?: unknown;
      heroImage?: unknown;
    };

    validateLength('title', body.title, LIMITS.title);
    validateLength('description', body.description, LIMITS.description);
    validateLength('content', body.content, LIMITS.content);

    const status: PostStatus = body.status === 'published' ? 'published' : 'draft';
    const heroImage = typeof body.heroImage === 'string' && body.heroImage ? body.heroImage : null;
    validateHttpsUrl('heroImage', heroImage);

    const baseSlug = generateSlug(body.title as string);
    const slug = await uniqueSlug(db, baseSlug);

    const created = await createPost(db, {
      title: body.title as string,
      slug,
      description: body.description as string,
      content: body.content as string,
      status,
      heroImage,
      userId: user.id,
    });
    return new Response(JSON.stringify(created), {
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
