// Google OAuth initiate endpoint
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ redirect, url }) => {
  // Get environment variables from runtime
  const GOOGLE_CLIENT_ID = import.meta.env.GOOGLE_CLIENT_ID;

  if (!GOOGLE_CLIENT_ID) {
    console.error('[OAUTH] GOOGLE_CLIENT_ID not configured');
    return new Response(
      JSON.stringify({ error: 'Google OAuth not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Build OAuth URL
  const redirectUri = `${url.origin}/api/auth/google/callback`;
  const scope = 'openid email profile';
  const state = crypto.randomUUID(); // CSRF protection

  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleAuthUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
  googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
  googleAuthUrl.searchParams.set('response_type', 'code');
  googleAuthUrl.searchParams.set('scope', scope);
  googleAuthUrl.searchParams.set('state', state);

  // Store state in a cookie for verification in callback
  // Note: In production, you might want to store this in a database or KV store
  const response = redirect(googleAuthUrl.toString(), 302);
  response.headers.set(
    'Set-Cookie',
    `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`
  );

  return response;
};
