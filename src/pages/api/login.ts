import type { APIRoute } from 'astro';
import { authenticateUser, createSession, SESSION_TTL_MS } from '../../lib/auth';
import { LIMITS, validateLength, ValidationError } from '../../lib/validation';

export const POST: APIRoute = async ({ request, cookies, locals, redirect }) => {
  const db = locals.runtime.env.DB;
  const contentType = request.headers.get('content-type') || '';
  const isFormSubmit =
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data');
  try {
    let username: unknown;
    let password: unknown;
    if (isFormSubmit) {
      const form = await request.formData();
      username = form.get('username');
      password = form.get('password');
    } else {
      const body = (await request.json()) as { username?: unknown; password?: unknown };
      username = body.username;
      password = body.password;
    }
    validateLength('username', username, LIMITS.username);
    validateLength('password', password, 200);

    const user = await authenticateUser(db, username as string, password as string);
    if (!user) {
      if (isFormSubmit) return redirect('/admin/login?error=invalid_credentials', 303);
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

    if (isFormSubmit) return redirect('/admin', 303);
    return new Response(
      JSON.stringify({ ok: true, user: { id: user.id, username: user.username, role: user.role } }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  } catch (err) {
    if (err instanceof ValidationError) {
      if (isFormSubmit) return redirect(`/admin/login?error=invalid_request`, 303);
      return new Response(JSON.stringify({ error: err.message, field: err.field }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (isFormSubmit) return redirect('/admin/login?error=server_error', 303);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
};
