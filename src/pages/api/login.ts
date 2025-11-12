// Login API route

import type { APIRoute } from 'astro';
import { authenticateUser, createSession } from '../../lib/auth';

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return new Response(
        JSON.stringify({ error: 'Username and password are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get D1 database from runtime
    const db = locals.runtime.env.DB;

    // Authenticate user
    const user = await authenticateUser(db, username, password);

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Invalid username or password' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create session
    const sessionId = await createSession(db, user.id);

    // Set cookie
    cookies.set('session', sessionId, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return new Response(
      JSON.stringify({ success: true, user }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Login error:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred during login' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
