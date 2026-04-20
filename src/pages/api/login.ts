import type { APIRoute } from 'astro';
import { authenticateUser, createSession, SESSION_TTL_MS } from '../../lib/auth';
import { LIMITS, validateLength, ValidationError } from '../../lib/validation';

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const db = locals.runtime.env.DB;
  try {
    const body = (await request.json()) as { username?: unknown; password?: unknown };
    validateLength('username', body.username, LIMITS.username);
    validateLength('password', body.password, 200);

    const user = await authenticateUser(db, body.username as string, body.password as string);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    }

    const session = await createSession(db, user.id);
    cookies.set('session', session.id, {
      path: '/',
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
    });

    return new Response(
      JSON.stringify({ ok: true, user: { id: user.id, username: user.username, role: user.role } }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
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
