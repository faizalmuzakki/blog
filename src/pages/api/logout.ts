// Logout API route

import type { APIRoute } from 'astro';
import { deleteSession } from '../../lib/auth';

export const POST: APIRoute = async ({ cookies, locals }) => {
  try {
    const sessionId = cookies.get('session')?.value;

    if (sessionId) {
      const db = locals.runtime.env.DB;
      await deleteSession(db, sessionId);
    }

    // Delete cookie
    cookies.delete('session', { path: '/' });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Logout error:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred during logout' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
