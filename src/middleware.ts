import { defineMiddleware } from 'astro:middleware';
import { getUserBySession, getSession, rotateSessionIfStale, SESSION_TTL_MS } from './lib/auth';

const CSP = [
  "default-src 'self'",
  "img-src 'self' https: data:",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join('; ');

const CSRF_EXEMPT_PREFIXES = ['/api/auth/google', '/api/login'];

function isCsrfExempt(pathname: string): boolean {
  return CSRF_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p));
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { cookies, request, locals, url } = context;
  const db = locals.runtime.env.DB;

  locals.user = null;
  locals.csrfToken = null;

  const sessionId = cookies.get('session')?.value ?? null;
  if (sessionId) {
    const session = await getSession(db, sessionId);
    if (session) {
      const user = await getUserBySession(db, session.id);
      if (user) {
        const rotated = await rotateSessionIfStale(db, session);
        locals.user = user;
        locals.csrfToken = rotated.csrfToken;

        if (rotated.id !== session.id) {
          cookies.set('session', rotated.id, {
            path: '/',
            httpOnly: true,
            secure: import.meta.env.PROD,
            sameSite: 'lax',
            maxAge: Math.floor(SESSION_TTL_MS / 1000),
          });
        }
      }
    }
  }

  if (url.pathname.startsWith('/api/') && request.method !== 'GET') {
    if (!isCsrfExempt(url.pathname)) {
      if (!locals.user || !locals.csrfToken) {
        return new Response('Unauthorized', { status: 401 });
      }
      const headerToken = request.headers.get('x-csrf-token');
      let formToken: string | null = null;
      if (!headerToken) {
        const ct = request.headers.get('content-type') ?? '';
        if (
          ct.includes('application/x-www-form-urlencoded') ||
          ct.includes('multipart/form-data')
        ) {
          const clone = request.clone();
          const form = await clone.formData();
          const value = form.get('_csrf');
          formToken = typeof value === 'string' ? value : null;
        }
      }
      const provided = headerToken ?? formToken;
      if (provided !== locals.csrfToken) {
        return new Response('Forbidden (CSRF)', { status: 403 });
      }
    }
  }

  const response = await next();
  response.headers.set('Content-Security-Policy', CSP);
  return response;
});
