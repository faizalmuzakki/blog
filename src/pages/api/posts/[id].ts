// Posts API routes - Get, Update, Delete by ID

import type { APIRoute } from 'astro';
import { getUserBySession, canModifyPost } from '../../../lib/auth';
import { getPostById, updatePost, deletePost, generateSlug, slugExists } from '../../../lib/db';

// GET - Get single post by ID
export const GET: APIRoute = async ({ params, locals, cookies }) => {
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

    const id = parseInt(params.id || '');

    if (isNaN(id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid post ID' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const post = await getPostById(db, id);

    if (!post) {
      return new Response(
        JSON.stringify({ error: 'Post not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ post }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Get post error:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred while fetching the post' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// PUT - Update post
export const PUT: APIRoute = async ({ params, request, locals, cookies }) => {
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

    const id = parseInt(params.id || '');

    if (isNaN(id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid post ID' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if post exists and user can modify it
    const existingPost = await getPostById(db, id);

    if (!existingPost) {
      return new Response(
        JSON.stringify({ error: 'Post not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!canModifyPost(user, existingPost.userId)) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: You do not have permission to modify this post' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { title, slug, description, content, isPrivate, privatePassword, heroImage } = await request.json();

    // If title changed, regenerate slug
    let updatedSlug = slug;
    if (title && !slug) {
      updatedSlug = generateSlug(title);

      // Check if slug exists (excluding current post)
      if (await slugExists(db, updatedSlug, id)) {
        let counter = 1;
        let newSlug = `${updatedSlug}-${counter}`;
        while (await slugExists(db, newSlug, id)) {
          counter++;
          newSlug = `${updatedSlug}-${counter}`;
        }
        updatedSlug = newSlug;
      }
    }

    const post = await updatePost(db, id, {
      ...(title && { title }),
      ...(updatedSlug && { slug: updatedSlug }),
      ...(description && { description }),
      ...(content && { content }),
      ...(isPrivate !== undefined && { isPrivate }),
      ...(privatePassword !== undefined && { privatePassword }),
      ...(heroImage !== undefined && { heroImage }),
      userId: user.id,
    });

    return new Response(
      JSON.stringify({ post }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Update post error:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred while updating the post' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// DELETE - Delete post
export const DELETE: APIRoute = async ({ params, locals, cookies }) => {
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

    const id = parseInt(params.id || '');

    if (isNaN(id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid post ID' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if post exists and user can modify it
    const existingPost = await getPostById(db, id);

    if (!existingPost) {
      return new Response(
        JSON.stringify({ error: 'Post not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!canModifyPost(user, existingPost.userId)) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: You do not have permission to delete this post' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    await deletePost(db, id);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Delete post error:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred while deleting the post' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
