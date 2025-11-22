// Google OAuth callback endpoint
import type { APIRoute } from 'astro';
import { findOrCreateGoogleUser, createSession } from '../../../../lib/auth';

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  id_token: string;
}

interface GoogleUserInfo {
  sub: string; // Google user ID
  email: string;
  name: string;
  picture?: string;
  email_verified: boolean;
}

export const GET: APIRoute = async ({ url, cookies, locals, redirect }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  // Check for OAuth errors
  if (error) {
    console.error('[OAUTH] Google OAuth error:', error);
    return redirect('/admin/login?error=oauth_failed');
  }

  if (!code || !state) {
    console.error('[OAUTH] Missing code or state parameter');
    return redirect('/admin/login?error=invalid_request');
  }

  // Verify state (CSRF protection)
  const storedState = cookies.get('oauth_state')?.value;
  if (!storedState || storedState !== state) {
    console.error('[OAUTH] State mismatch - possible CSRF attack');
    return redirect('/admin/login?error=state_mismatch');
  }

  // Clear the state cookie
  cookies.delete('oauth_state', { path: '/' });

  // Get environment variables
  const GOOGLE_CLIENT_ID = import.meta.env.GOOGLE_CLIENT_ID;
  const GOOGLE_CLIENT_SECRET = import.meta.env.GOOGLE_CLIENT_SECRET;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.error('[OAUTH] Google OAuth not properly configured');
    return redirect('/admin/login?error=server_error');
  }

  try {
    // Exchange code for access token
    const redirectUri = `${url.origin}/api/auth/google/callback`;
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('[OAUTH] Token exchange failed:', errorData);
      return redirect('/admin/login?error=token_exchange_failed');
    }

    const tokenData: GoogleTokenResponse = await tokenResponse.json();

    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      console.error('[OAUTH] Failed to get user info from Google');
      return redirect('/admin/login?error=userinfo_failed');
    }

    const userInfo: GoogleUserInfo = await userInfoResponse.json();

    console.log('[OAUTH] User info received:', {
      sub: userInfo.sub,
      email: userInfo.email,
      name: userInfo.name,
    });

    // Find or create user in database
    const db = locals.runtime.env.DB;
    const user = await findOrCreateGoogleUser(
      db,
      userInfo.sub,
      userInfo.email,
      userInfo.name
    );

    console.log('[OAUTH] User found/created:', user.username);

    // Create session
    const sessionId = await createSession(db, user.id);

    // Set session cookie
    cookies.set('session', sessionId, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    // Redirect to admin dashboard
    return redirect('/admin');
  } catch (error) {
    console.error('[OAUTH] Unexpected error during OAuth flow:', error);
    return redirect('/admin/login?error=server_error');
  }
};
