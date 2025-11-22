# Google OAuth Setup Guide

This guide explains how to set up Google OAuth authentication for your blog.

## Prerequisites

- A Google Cloud Platform account
- Your blog deployed and accessible via a public URL

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API (or Google Identity Services)

## Step 2: Configure OAuth Consent Screen

1. In the Google Cloud Console, go to **APIs & Services** > **OAuth consent screen**
2. Choose **External** user type (or Internal if using Google Workspace)
3. Fill in the required information:
   - App name: Your Blog Name
   - User support email: Your email
   - Developer contact email: Your email
4. Add scopes:
   - `openid`
   - `email`
   - `profile`
5. Save and continue

## Step 3: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. Choose **Web application**
4. Configure:
   - Name: "Blog Admin OAuth"
   - Authorized JavaScript origins:
     - `https://yourdomain.com`
     - `http://localhost:4321` (for local development)
   - Authorized redirect URIs:
     - `https://yourdomain.com/api/auth/google/callback`
     - `http://localhost:4321/api/auth/google/callback` (for local development)
5. Click **Create**
6. Save your **Client ID** and **Client Secret**

## Step 4: Configure Environment Variables

### For Local Development

Create a `.dev.vars` file in your project root:

```env
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret-here
```

### For Cloudflare Pages Production

1. Go to your Cloudflare Pages dashboard
2. Select your project
3. Go to **Settings** > **Environment variables**
4. Add the following variables for **Production**:
   - `GOOGLE_CLIENT_ID`: Your Google OAuth Client ID
   - `GOOGLE_CLIENT_SECRET`: Your Google OAuth Client Secret
5. Also add them for **Preview** if you want OAuth in preview deployments

### For Wrangler (Cloudflare Workers)

Add to your `wrangler.toml`:

```toml
[vars]
# Don't put secrets here!

# For secrets, use wrangler secret put:
# wrangler secret put GOOGLE_CLIENT_ID
# wrangler secret put GOOGLE_CLIENT_SECRET
```

Then set secrets via CLI:
```bash
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
```

## Step 5: Update Database Schema

Run the migration to add OAuth support to your database:

```bash
# For remote D1 database
wrangler d1 execute blog-db --remote --file=./migrations/001_add_oauth_support.sql

# For local development database
wrangler d1 execute blog-db --local --file=./migrations/001_add_oauth_support.sql
```

Or manually run the SQL:
```sql
ALTER TABLE users ADD COLUMN email TEXT UNIQUE;
ALTER TABLE users ADD COLUMN google_id TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
```

## Step 6: Test the Integration

1. Start your development server: `npm run dev`
2. Go to `/admin/login`
3. Click "Sign in with Google"
4. Complete the Google OAuth flow
5. You should be redirected to the admin dashboard

## How It Works

1. User clicks "Sign in with Google" button
2. User is redirected to Google's OAuth consent screen
3. After approval, Google redirects back to `/api/auth/google/callback` with an authorization code
4. The callback endpoint exchanges the code for an access token
5. The access token is used to fetch user information from Google
6. A user account is created or linked based on the Google ID
7. A session is created and the user is logged in
8. User is redirected to the admin dashboard

## Security Features

- **CSRF Protection**: Uses state parameter to prevent CSRF attacks
- **Secure Cookies**: Session cookies are HttpOnly, Secure, and SameSite
- **Automatic User Creation**: New Google users are automatically created with unique usernames
- **Email Verification**: Only verified Google emails can sign in

## Troubleshooting

### "Google OAuth not configured" error
- Make sure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` environment variables are set

### "redirect_uri_mismatch" error
- Verify that the redirect URI in your Google Cloud Console matches exactly: `https://yourdomain.com/api/auth/google/callback`
- Make sure the protocol (http vs https) matches

### User created but can't see posts
- This is normal for OAuth users - they have read/write access to the blog
- All authenticated users can create posts

## Additional Notes

- OAuth users will have auto-generated usernames based on their email (e.g., `johndoe` from `johndoe@gmail.com`)
- If the username already exists, a number will be appended (e.g., `johndoe1`, `johndoe2`)
- OAuth users don't have passwords - they can only log in via Google
- Regular username/password authentication still works for non-OAuth users
