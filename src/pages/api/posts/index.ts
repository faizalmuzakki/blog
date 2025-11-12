// Posts API routes - List and Create

import type { APIRoute } from 'astro';
import { getUserBySession } from '../../../lib/auth';
import { getAllPosts, createPost, generateSlug, slugExists } from '../../../lib/db';

// GET - List all posts (requires authentication)
export const GET: APIRoute = async ({ locals, cookies }) => {
  try {
    const sessionId = cookies.get('session')?.value;

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const db = locals.runtime.env.DB;
    const user = await getUserBySession(db, sessionId);

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const posts = await getAllPosts(db);

    return new Response(
      JSON.stringify({ posts }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Get posts error:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred while fetching posts' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// POST - Create new post (requires authentication)
export const POST: APIRoute = async ({ request, locals, cookies }) => {
  try {
    const sessionId = cookies.get('session')?.value;

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const db = locals.runtime.env.DB;
    const user = await getUserBySession(db, sessionId);

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { title, description, content, isPrivate, privatePassword, heroImage } = await request.json();

    if (!title || !description || !content) {
      return new Response(
        JSON.stringify({ error: 'Title, description, and content are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate slug from title
    let slug = generateSlug(title);

    // Check if slug exists, if so, append a number
    if (await slugExists(db, slug)) {
      let counter = 1;
      let newSlug = `${slug}-${counter}`;
      while (await slugExists(db, newSlug)) {
        counter++;
        newSlug = `${slug}-${counter}`;
      }
      slug = newSlug;
    }

    const post = await createPost(db, {
      title,
      slug,
      description,
      content,
      isPrivate: isPrivate || false,
      privatePassword: privatePassword || null,
      heroImage: heroImage || null,
      userId: user.id,
    });

    return new Response(
      JSON.stringify({ post }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Create post error:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred while creating the post' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
