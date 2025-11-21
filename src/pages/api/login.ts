// Login API route

import type { APIRoute } from 'astro';
import { authenticateUser, createSession } from '../../lib/auth';

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  try {
    const { username, password } = await request.json();

    console.log('[LOGIN] Attempting login for username:', username);

    if (!username || !password) {
      console.log('[LOGIN] Missing username or password');
      return new Response(
        JSON.stringify({ error: 'Username and password are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get D1 database from runtime
    const db = locals.runtime.env.DB;
    console.log('[LOGIN] Database connection:', db ? 'OK' : 'FAILED');

    // Authenticate user
    const user = await authenticateUser(db, username, password);

    if (!user) {
      console.log('[LOGIN] Authentication failed for username:', username);
      return new Response(
        JSON.stringify({ error: 'Invalid username or password' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[LOGIN] Authentication successful for user:', user.username);

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
