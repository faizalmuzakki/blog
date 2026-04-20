import type { APIRoute } from 'astro';
import { deleteSession } from '../../lib/auth';

export const POST: APIRoute = async ({ cookies, locals }) => {
  const db = locals.runtime.env.DB;
  const sessionId = cookies.get('session')?.value;
  if (sessionId) await deleteSession(db, sessionId);
  cookies.delete('session', { path: '/' });
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};
