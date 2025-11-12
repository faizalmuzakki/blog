# Personal Blog with Admin Dashboard

A dynamic personal blog built with Astro SSR, Cloudflare D1 database, and an admin dashboard for creating and managing posts. Features authentication, public/private posts, and easy deployment to Cloudflare Pages.

## Features

- **Admin Dashboard** - Login and manage your blog posts from a web interface
- **Create Posts Online** - Write and publish posts directly from your browser
- **Cloudflare D1 Database** - Serverless SQL database for storing posts
- **Authentication** - Secure login system (no signup required)
- **Public & Private Posts** - Control post visibility with password protection
- **Markdown Support** - Write posts in Markdown with live preview
- **Responsive Design** - Looks great on all devices
- **SSR with Astro** - Server-side rendering for dynamic content

## Quick Start

### Prerequisites

- Node.js 18 or higher
- Cloudflare account (free tier works!)
- Wrangler CLI (`npm install -g wrangler`)

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
- Insert seed data with default admin user
- Update your wrangler.toml with the database ID

**Default Login Credentials:**
- Username: `admin`
- Password: `admin123`

4. **Start the development server**

```bash
npm run dev
```

5. **Login to admin dashboard**

Visit `http://localhost:4321/admin/login` and use the default credentials above.

## Project Structure

```
/
├── public/              # Static assets
│   └── favicon.svg
├── src/
│   ├── lib/             # Utilities
│   │   ├── auth.ts      # Authentication functions
│   │   └── db.ts        # Database queries
│   ├── layouts/         # Page layouts
│   │   └── BaseLayout.astro
│   ├── pages/
│   │   ├── api/         # API routes
│   │   │   ├── login.ts
│   │   │   ├── logout.ts
│   │   │   └── posts/   # CRUD operations for posts
│   │   ├── admin/       # Admin dashboard
│   │   │   ├── login.astro
│   │   │   ├── index.astro  # Post list
│   │   │   ├── new.astro    # Create post
│   │   │   └── edit/[id].astro  # Edit post
│   │   ├── blog/
│   │   │   └── [slug].astro  # Individual blog posts
│   │   └── index.astro       # Home page (public blog list)
├── schema.sql           # Database schema
├── seed.sql             # Seed data
├── setup-d1.sh          # Database setup script
├── generate-password.js # Password hash generator
├── astro.config.mjs     # Astro configuration
└── wrangler.toml        # Cloudflare configuration
```

## Using the Admin Dashboard

### Login

1. Visit `/admin/login`
2. Enter your username and password
3. You'll be redirected to the admin dashboard

### Create a New Post

1. Click "New Post" button
2. Fill in the form:
   - **Title** - Post title
   - **Description** - Short description (appears in list)
   - **Content** - Full post content in Markdown
   - **Hero Image URL** (optional) - Header image
   - **Make this post private** - Toggle for password protection
   - **Private Password** - Password readers need to view (if private)
3. Click "Create Post"

### Edit a Post

1. From the admin dashboard, click "Edit" on any post
2. Modify the fields
3. Click "Update Post"

### Delete a Post

1. From the admin dashboard, click "Delete" on any post
2. Confirm the deletion

### Logout

Click the "Logout" button in the top-right corner of the admin dashboard.

## How Privacy Works

### Public Posts
- Appear in the main blog feed at `/`
- Accessible to everyone at `/blog/[slug]`
- Created by leaving "Make this post private" unchecked

### Private Posts
- **Hidden** from the main blog feed
- Require password to view content
- Still accessible via direct URL `/blog/[slug]`
- Useful for drafts or semi-private content

**Note:** Private posts use client-side password protection. For truly sensitive content, you should keep it offline or use server-side authentication.

## Changing Your Admin Password

To generate a new password hash:

```bash
node generate-password.js your-new-password
```

Then update the hash in your D1 database:

```bash
wrangler d1 execute personal-blog-db \
  --command "UPDATE users SET password_hash = 'YOUR_NEW_HASH' WHERE username = 'admin'"
```

Or update the `seed.sql` file and re-run the setup.

## Deployment to Cloudflare Pages

### Option 1: Via Cloudflare Dashboard (Recommended)

1. **Push your code to GitHub**

2. **Create Cloudflare Pages project**
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
   - Navigate to **Workers & Pages** > **Create application** > **Pages**
   - Connect your GitHub repository

3. **Configure build settings**
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Environment variables:** None required (D1 binding is set via dashboard)

4. **Configure D1 binding**
   - Go to **Settings** > **Functions** > **D1 database bindings**
   - Add binding:
     - Variable name: `DB`
     - D1 database: Select `personal-blog-db`

5. **Deploy!**

Every push to your repository will automatically deploy.

### Option 2: Using Wrangler CLI

```bash
# Build the project
npm run build

# Deploy to Cloudflare Pages
wrangler pages deploy dist --project-name=personal-blog

# Set up D1 binding (first time only)
# This is done via the dashboard: Settings > Functions > D1 database bindings
```

### Updating Production Database

After deployment, if you need to update your production database:

```bash
# Run migrations on production
wrangler d1 execute personal-blog-db --file=./schema.sql --remote

# Add seed data (if needed)
wrangler d1 execute personal-blog-db --file=./seed.sql --remote
```

## Environment: Local vs Production

### Local Development

Uses `wrangler dev` with local D1 database. All data is stored locally.

```bash
npm run dev
```

### Production

Uses Cloudflare Pages with remote D1 database. Data is stored in Cloudflare's edge network.

## Database Schema

### Users Table
- `id` - Primary key
- `username` - Unique username
- `password_hash` - Bcrypt hashed password
- `created_at` - Timestamp

### Posts Table
- `id` - Primary key
- `title` - Post title
- `slug` - URL-friendly slug
- `description` - Short description
- `content` - Full markdown content
- `is_private` - Boolean (0 = public, 1 = private)
- `private_password` - Password for private posts
- `hero_image` - Optional header image URL
- `created_at` - Timestamp
- `updated_at` - Timestamp
- `user_id` - Foreign key to users

### Sessions Table
- `id` - Session ID (primary key)
- `user_id` - Foreign key to users
- `expires_at` - Expiration timestamp
- `created_at` - Timestamp

## Customization

### Change Site Title & Description

Edit `src/pages/index.astro`:

```astro
const siteTitle = 'Your Blog Title';
```

### Update Colors

Modify CSS variables in `src/layouts/BaseLayout.astro`:

```css
:root {
  --accent: #2463eb;        /* Primary color */
  --accent-dark: #1d4ed8;   /* Hover color */
  /* ... */
}
```

### Change Site URL

Update `astro.config.mjs`:

```js
export default defineConfig({
  site: 'https://your-domain.com',
  // ...
});
```

## Commands

| Command           | Action                                       |
|:------------------|:---------------------------------------------|
| `npm install`     | Install dependencies                         |
| `npm run dev`     | Start local dev server at `localhost:4321`   |
| `npm run build`   | Build production site to `./dist/`           |
| `npm run preview` | Preview build locally before deploying       |
| `./setup-d1.sh`   | Set up Cloudflare D1 database               |

## Wrangler Commands

```bash
# List D1 databases
wrangler d1 list

# Query database (local)
wrangler d1 execute personal-blog-db --command "SELECT * FROM posts"

# Query database (remote/production)
wrangler d1 execute personal-blog-db --command "SELECT * FROM posts" --remote

# Run SQL file
wrangler d1 execute personal-blog-db --file=./schema.sql

# Run SQL file on production
wrangler d1 execute personal-blog-db --file=./schema.sql --remote
```

## Technologies Used

- **[Astro](https://astro.build)** - SSR framework
- **[Cloudflare D1](https://developers.cloudflare.com/d1/)** - Serverless SQL database
- **[Cloudflare Pages](https://pages.cloudflare.com/)** - Hosting & deployment
- **[TypeScript](https://www.typescriptlang.org/)** - Type safety
- **[Marked](https://marked.js.org/)** - Markdown parser
- **[bcrypt.js](https://github.com/dcodeIO/bcrypt.js)** - Password hashing

## Security Notes

- **Passwords**: Stored as bcrypt hashes in the database
- **Sessions**: 7-day expiration, stored in D1
- **Private posts**: Client-side password protection (not suitable for sensitive data)
- **Authentication**: Required for all admin operations
- **HTTPS**: Always use HTTPS in production (automatic with Cloudflare Pages)

## Troubleshooting

### "DB is not defined" error

Make sure your D1 binding is configured correctly in `wrangler.toml` and in your Cloudflare Pages settings.

### Can't login

1. Check that the database was set up correctly: `wrangler d1 execute personal-blog-db --command "SELECT * FROM users"`
2. Try resetting your password using `generate-password.js`
3. Check browser console for errors

### Changes not appearing in production

1. Make sure you committed and pushed your changes
2. Check Cloudflare Pages deployment logs
3. Ensure D1 binding is configured in Cloudflare Pages settings

## License

MIT

## Support

For issues with:
- **Astro**: [Astro Discord](https://astro.build/chat) or [Astro Docs](https://docs.astro.build)
- **Cloudflare D1**: [Cloudflare Discord](https://discord.gg/cloudflaredev) or [D1 Docs](https://developers.cloudflare.com/d1/)
- **This project**: Open an issue in this repository

---

Built with ❤️ using Astro + Cloudflare D1
