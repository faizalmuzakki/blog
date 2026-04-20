# Blog with Admin Dashboard

A dynamic blog built with Astro SSR, Cloudflare D1 database, and an admin dashboard for creating and managing posts. Features authentication (username/password + Google OAuth), role-based access control, draft/published posts, and easy deployment to Cloudflare Pages.

## Features

- **Multiple Authentication Methods**
  - Traditional username/password login
  - Google OAuth integration
  - Secure session management

- **Role-Based Access Control**
  - Admin users: Manage all posts across all users
  - Regular users: Manage only their own posts
  - Automatic role assignment (existing users → admin, OAuth users → user)

- **Post Management**
  - Create, edit, and delete posts via the admin dashboard
  - Draft / Published status — drafts visible only to the author (and admins)
  - Author attribution on all posts
  - Sanitized Markdown with hero images

- **Admin Dashboard**
  - Admins see all posts from all users
  - Regular users see only their posts
  - Edit/delete buttons shown based on permissions

- **Modern Stack**
  - Cloudflare D1 serverless database
  - Astro SSR for dynamic content
  - TypeScript for type safety
  - Responsive design

## Session and CSRF

- Sessions expire after 24 hours of inactivity. Active sessions rotate their ID every hour to limit the blast radius of a leaked cookie.
- All non-GET requests to `/api/*` (except `/api/login` and `/api/auth/google*`) must carry a CSRF token. The token is exposed to admin pages as `Astro.locals.csrfToken` and included automatically by the bundled forms.

## Quick Start

### Prerequisites

- Node.js 18 or higher
- Cloudflare account (free tier works!)
- Wrangler CLI: `npm install -g wrangler`
- (Optional) Google Cloud account for OAuth

### Installation

1. **Clone this repository**

```bash
git clone <your-repo-url>
cd blog
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up Cloudflare D1 database**

```bash
# Login to Cloudflare
wrangler login

# Run the automated setup script
./setup-d1.sh
```

This script will:

- Create your D1 database
- Set up the schema (users, posts, sessions tables)
- Insert seed data (blog posts)
- Generate a random admin password and insert the admin user
- Update your wrangler.toml with the database ID

### Admin credentials

`./setup-d1.sh` generates a random admin password on first run and prints it once:

    ⚠️  Save this password now — it will not be shown again.

       Username: admin
       Password: <generated>

Store it in a password manager. If you lose it, generate a new hash with:

    node generate-password.js --hash-only "<new-password>"

and update the row:

    wrangler d1 execute blog-db --remote \
      --command "UPDATE users SET password_hash = '<new-hash>' WHERE username = 'admin'"

4. **Start the development server**

```bash
npm run dev
```

5. **Login to admin dashboard**

Visit `http://localhost:4321/admin/login` and use the admin credentials printed during setup.

## Setting Up Google OAuth (Optional)

To enable Google sign-in, follow the detailed guide in [`GOOGLE_OAUTH_SETUP.md`](./GOOGLE_OAUTH_SETUP.md).

**Quick steps:**

1. Create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/)
2. Add credentials to `.dev.vars` for local development
3. Add credentials to Cloudflare Pages environment variables for production

**Local development (`.dev.vars`):**

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
PUBLIC_SITE_URL=http://localhost:4321
```

**Production:**
Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` as environment variables in Cloudflare Pages dashboard.

## Deployment to Production

### First-Time Deployment

#### Step 1: Push code to GitHub

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

#### Step 2: Create Cloudflare Pages project

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Workers & Pages** > **Create application** > **Pages**
3. Connect your GitHub repository
4. Configure build settings:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** `/` (or leave blank)

#### Step 3: Configure D1 database binding

1. Go to your Cloudflare Pages project
2. Navigate to **Settings** > **Functions** > **D1 database bindings**
3. Add binding:
   - **Variable name:** `DB`
   - **D1 database:** Select `blog-db` (or your database name)

#### Step 4: Set up environment variables

1. Go to **Settings** > **Environment variables**
2. Add for **Production**:
   - `PUBLIC_SITE_URL`: Your production URL (e.g. `https://blog.example.com`). Used by RSS + sitemap.
   - `GOOGLE_CLIENT_ID`: Your Google OAuth Client ID (if using Google OAuth)
   - `GOOGLE_CLIENT_SECRET`: Your Google OAuth Client Secret (if using Google OAuth)
3. (Optional) Add the same for **Preview** deployments

#### Step 5: Run database migrations on production

```bash
# Run the migration to add OAuth and role support
wrangler d1 execute blog-db --remote --file=./migrations/001_add_oauth_support.sql
```

This migration adds:

- `email` column for OAuth users
- `google_id` column for Google user IDs
- `role` column for access control
- Sets existing users to `admin` role
- Adds necessary indexes

#### Step 6: Deploy!

Your site will automatically deploy. Every push to your main branch will trigger a new deployment.

After deploying, edit `public/robots.txt` and replace `REPLACE-WITH-YOUR-DOMAIN` with your actual domain. This only needs to be done once.

### Updating an Existing Deployment

If you already have a deployed blog and are adding these new features:

1. **Pull latest code**

```bash
git pull origin main
```

2. **Run migrations locally (optional - for testing)**

```bash
wrangler d1 execute blog-db --local --file=./migrations/001_add_oauth_support.sql
```

3. **Run migrations on production**

```bash
wrangler d1 execute blog-db --remote --file=./migrations/001_add_oauth_support.sql
```

4. **Add Google OAuth environment variables** (if using OAuth)

In Cloudflare Pages dashboard:

- Settings > Environment variables
- Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

5. **Deploy**

```bash
git push origin main
# Cloudflare Pages will automatically deploy
```

## User Roles & Permissions

### Admin Role

- See all posts from all users
- Edit and delete any post
- Full access to admin dashboard
- Existing users are set to admin by default

### User Role

- See only their own posts
- Edit and delete only their own posts
- Cannot modify other users' posts
- New Google OAuth users get this role

### How Roles are Assigned

- **Existing users** (before migration): Automatically set to `admin`
- **New Google OAuth users**: Created as `user`
- **New username/password users**: Currently created as `user` (can be changed in code)

## Common Workflows

### Working with Production Data Locally

```bash
# Pull latest data from production
npm run db:pull

# Start dev server
npm run dev

# Make changes and test locally...
```

### Deploying Changes

```bash
# Commit your changes
git add .
git commit -m "Your changes"
git push origin main

# Cloudflare Pages will automatically deploy

# If you made database schema changes, run migrations:
wrangler d1 execute blog-db --remote --file=./migrations/your-migration.sql
```

### Running Migrations

```bash
# Local development
wrangler d1 execute blog-db --local --file=./migrations/001_add_oauth_support.sql

# Production
wrangler d1 execute blog-db --remote --file=./migrations/001_add_oauth_support.sql
```

### Syncing Databases

#### Pull from Remote (Production → Local)

```bash
npm run db:pull
```

#### Push to Remote (Local → Production)

⚠️ **Warning:** This overwrites your production database!

```bash
npm run db:push
```

## Project Structure

```
/
├── migrations/          # Database migrations
│   └── 001_add_oauth_support.sql
├── public/              # Static assets
│   └── favicon.svg
├── src/
│   ├── lib/             # Utilities
│   │   ├── auth.ts      # Authentication & authorization functions
│   │   └── db.ts        # Database queries
│   ├── layouts/         # Page layouts
│   │   └── BaseLayout.astro
│   ├── pages/
│   │   ├── api/         # API routes
│   │   │   ├── auth/    # OAuth endpoints
│   │   │   │   ├── google.ts        # OAuth initiate
│   │   │   │   └── google/callback.ts  # OAuth callback
│   │   │   ├── login.ts
│   │   │   ├── logout.ts
│   │   │   └── posts/   # CRUD operations for posts
│   │   ├── admin/       # Admin dashboard
│   │   │   ├── login.astro     # Login page (username/password + Google)
│   │   │   ├── index.astro     # Post list (filtered by role)
│   │   │   ├── new.astro       # Create post
│   │   │   └── edit/[id].astro # Edit post
│   │   ├── blog/
│   │   │   └── [slug].astro    # Individual blog posts
│   │   └── index.astro          # Home page (public blog list)
├── schema.sql                    # Database schema
├── seed.sql                      # Seed data
├── .env.example                  # Environment variables template
├── GOOGLE_OAUTH_SETUP.md        # Detailed OAuth setup guide
├── setup-d1.sh                   # Database setup script
├── generate-password.js          # Password hash generator
├── astro.config.mjs              # Astro configuration
└── wrangler.toml                 # Cloudflare configuration
```

## Using the Admin Dashboard

### Login

**Option 1: Username/Password**

1. Visit `/admin/login`
2. Enter username and password
3. Click "Login"

**Option 2: Google OAuth**

1. Visit `/admin/login`
2. Click "Sign in with Google"
3. Authorize with your Google account
4. Automatic account creation with unique username

### Create a New Post

1. Click "New Post" button
2. Fill in the form:
   - **Title** - Post title
   - **Description** - Short description (appears in list)
   - **Content** - Full post content in Markdown
   - **Hero Image URL** (optional) - Header image
   - **Status** - Draft (visible only to you and admins) or Published
3. Click "Create Post"
4. Post is automatically attributed to you

### Edit/Delete Posts

**As Admin:**

- See all posts from all users
- Can edit/delete any post

**As Regular User:**

- See only your own posts
- Can edit/delete only your posts
- Edit/delete buttons hidden for others' posts

### Logout

Click the "Logout" button in the top-right corner of the admin dashboard.

## Database Schema

### Users Table

- `id` - Primary key
- `username` - Unique username
- `password_hash` - PBKDF2 hashed password (NULL for OAuth users)
- `email` - Email address (for OAuth users)
- `google_id` - Google OAuth ID (unique)
- `role` - User role ('admin' or 'user')
- `created_at` - Timestamp

### Posts Table

- `id` - Primary key
- `title` - Post title
- `slug` - URL-friendly slug (auto-generated)
- `description` - Short description
- `content` - Full markdown content
- `status` - `'draft'` or `'published'`
- `hero_image` - Optional header image URL
- `created_at` - Timestamp
- `updated_at` - Timestamp
- `user_id` - Foreign key to users (author)

### Sessions Table

- `id` - Session ID (primary key)
- `user_id` - Foreign key to users
- `expires_at` - Expiration timestamp (24 hours inactivity)
- `created_at` - Timestamp

## API Endpoints

### Authentication

- `POST /api/login` - Username/password login
- `POST /api/logout` - Logout (clears session)
- `GET /api/auth/google` - Initiate Google OAuth flow
- `GET /api/auth/google/callback` - OAuth callback handler

### Posts

- `GET /api/posts` - List posts (filtered by role)
- `POST /api/posts` - Create new post (requires auth)
- `GET /api/posts/:id` - Get single post (requires auth)
- `PUT /api/posts/:id` - Update post (requires ownership or admin)
- `DELETE /api/posts/:id` - Delete post (requires ownership or admin)

## Authorization System

### Helper Functions

```typescript
isAdmin(user); // Check if user has admin role
canModifyPost(user, postUserId); // Check if user can edit/delete post
canViewAllPosts(user); // Check if user can see all posts
```

### API Authorization

- **GET /api/posts** - Returns all posts for admins, only user's posts for regular users
- **PUT /api/posts/:id** - Returns 403 if user doesn't own post (unless admin)
- **DELETE /api/posts/:id** - Returns 403 if user doesn't own post (unless admin)

## Changing Your Admin Password

To generate a new password hash:

```bash
node generate-password.js your-new-password
```

Then update the hash in your D1 database:

```bash
# Local
wrangler d1 execute blog-db \
  --command "UPDATE users SET password_hash = 'YOUR_NEW_HASH' WHERE username = 'admin'"

# Production
wrangler d1 execute blog-db --remote \
  --command "UPDATE users SET password_hash = 'YOUR_NEW_HASH' WHERE username = 'admin'"
```

## Commands

| Command              | Action                                              |
| :------------------- | :-------------------------------------------------- |
| `npm install`        | Install dependencies                                |
| `npm run dev`        | Start local dev server at `localhost:4321`          |
| `npm run build`      | Build production site to `./dist/`                  |
| `npm run preview`    | Preview build locally before deploying              |
| `npm run deploy`     | Build and deploy to Cloudflare Pages                |
| `npm run lint`       | Lint all `.ts` and `.astro` files                   |
| `npm run format`     | Format all files with Prettier                      |
| `npm run type-check` | Run `astro check`                                   |
| `npm test`           | Run Vitest unit tests                               |
| `npm run db:pull`    | Sync remote database to local                       |
| `npm run db:push`    | Sync local database to remote (⚠️ overwrites)       |
| `./setup-d1.sh`      | Create D1 DB, apply schema, generate admin password |

## Wrangler Commands

```bash
# List D1 databases
wrangler d1 list

# Query database (local)
wrangler d1 execute blog-db --command "SELECT * FROM posts"

# Query database (remote/production)
wrangler d1 execute blog-db --command "SELECT * FROM posts" --remote

# Run SQL file on local database
wrangler d1 execute blog-db --file=./schema.sql

# Run SQL file on production database
wrangler d1 execute blog-db --file=./schema.sql --remote

# Run migration on production
wrangler d1 execute blog-db --remote --file=./migrations/001_add_oauth_support.sql
```

## Technologies Used

- **[Astro](https://astro.build)** - SSR framework
- **[Cloudflare D1](https://developers.cloudflare.com/d1/)** - Serverless SQL database
- **[Cloudflare Pages](https://pages.cloudflare.com/)** - Hosting & deployment
- **[TypeScript](https://www.typescriptlang.org/)** - Type safety
- **[Marked](https://marked.js.org/)** - Markdown parser
- **[Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)** - Authentication

## Security Features

- ✅ **Password Hashing**: PBKDF2 with 100,000 iterations
- ✅ **Session Management**: HttpOnly, Secure cookies with 24-hour inactivity expiry; session ID rotated hourly
- ✅ **CSRF Protection**: Token required on all mutating API requests; state parameter for OAuth flows
- ✅ **Role-Based Access Control**: Admin vs User permissions
- ✅ **Server-Side Authorization**: API enforces ownership checks
- ✅ **HTTPS**: Required in production (automatic with Cloudflare Pages)

## Rate limiting (production)

Rate limiting is configured in the Cloudflare dashboard, not in the app. Recommended rules:

| Path                        | Limit                     | Action               |
| --------------------------- | ------------------------- | -------------------- |
| `/api/login`                | 10 requests / minute / IP | Block for 10 minutes |
| `/api/auth/google/callback` | 20 requests / minute / IP | Block for 10 minutes |
| `/api/posts` (POST)         | 30 requests / minute / IP | Challenge            |

Add these in **Security > WAF > Rate limiting rules** for the production zone.

## Troubleshooting

### "DB is not defined" error

**Solution:** Configure D1 binding in Cloudflare Pages:

1. Settings > Functions > D1 database bindings
2. Add binding: Variable name `DB`, Database `blog-db`

### Can't login after migration

**Solution:** Run the migration to add the role column:

```bash
wrangler d1 execute blog-db --remote --file=./migrations/001_add_oauth_support.sql
```

### Google OAuth not working

**Solutions:**

1. Check environment variables are set in Cloudflare Pages
2. Verify redirect URIs in Google Cloud Console match your domain
3. Ensure callback URL is: `https://yourdomain.com/api/auth/google/callback`

### 403 Forbidden when editing posts

**Expected behavior:** Regular users can only edit their own posts. Admins can edit any post.

**To make a user admin:**

```bash
wrangler d1 execute blog-db --remote \
  --command "UPDATE users SET role = 'admin' WHERE username = 'username'"
```

### Changes not appearing in production

**Solutions:**

1. Check Cloudflare Pages deployment logs
2. Ensure you committed and pushed changes
3. Verify D1 binding is configured
4. Run migrations if schema changed
5. Clear browser cache

## Migration order (this release)

Before pushing the updated code to production, run the new migrations on the remote D1 in order:

```bash
wrangler d1 execute blog-db --remote --file=./migrations/002_drafts_replace_private.sql
wrangler d1 execute blog-db --remote --file=./migrations/003_sessions_csrf.sql
wrangler d1 execute blog-db --remote --file=./migrations/004_cascade_deletes.sql
```

Existing sessions are invalidated by migration 003 — users will need to log in again.

## License

MIT

## Support

For issues with:

- **Astro**: [Astro Discord](https://astro.build/chat) or [Astro Docs](https://docs.astro.build)
- **Cloudflare D1**: [Cloudflare Discord](https://discord.gg/cloudflaredev) or [D1 Docs](https://developers.cloudflare.com/d1/)
- **Google OAuth**: [GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md)
- **This project**: Open an issue in this repository

---

Built with ❤️ using Astro + Cloudflare D1 + Google OAuth
