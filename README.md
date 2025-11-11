# Personal Blog

A simple, fast personal blog built with Astro and deployed to Cloudflare Pages. Features public and private post functionality.

## Features

- **Fast & Lightweight** - Built with Astro for optimal performance
- **Public & Private Posts** - Control post visibility with password protection
- **Markdown Support** - Write posts in Markdown
- **Responsive Design** - Looks great on all devices
- **Easy Deployment** - One-click deploy to Cloudflare Pages

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Installation

1. Clone this repository
2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

Visit `http://localhost:4321` to see your blog!

## Project Structure

```
/
├── public/              # Static assets
│   └── favicon.svg
├── src/
│   ├── content/         # Blog posts (Markdown files)
│   │   ├── config.ts    # Content collection configuration
│   │   └── blog/        # Blog post files
│   ├── layouts/         # Page layouts
│   │   └── BaseLayout.astro
│   └── pages/           # Page routes
│       ├── index.astro           # Home page (blog list)
│       └── blog/[...slug].astro  # Individual blog posts
├── astro.config.mjs     # Astro configuration
├── package.json
└── tsconfig.json
```

## Writing Blog Posts

Create new blog posts in `src/content/blog/` as Markdown files.

### Public Post Example

```markdown
---
title: 'My Public Post'
description: 'This post is visible to everyone'
pubDate: 2024-11-11
isPrivate: false
---

# My Content

Write your post content here...
```

### Private Post Example

```markdown
---
title: 'My Private Post'
description: 'This post requires a password'
pubDate: 2024-11-11
isPrivate: true
privatePassword: 'your-password-here'
---

# My Private Content

This won't appear in the blog list and requires a password to view.
```

### Frontmatter Fields

- `title` - Post title (required)
- `description` - Short description (required)
- `pubDate` - Publication date (required)
- `updatedDate` - Last update date (optional)
- `heroImage` - Header image URL (optional)
- `isPrivate` - Set to `true` for password-protected posts (default: false)
- `privatePassword` - Password for private posts (default: 'secret')

## How Privacy Works

**Public Posts:**
- Appear in the main blog feed
- Accessible to everyone
- Set `isPrivate: false` or omit the field

**Private Posts:**
- Don't appear in the main blog feed
- Require password to view content
- Accessible via direct URL
- Set `isPrivate: true` and optionally set `privatePassword`

**Note:** This is client-side password protection. For truly sensitive content, use proper server-side authentication or keep content offline.

## Deployment to Cloudflare Pages

### Option 1: Via Cloudflare Dashboard (Recommended)

1. Push your code to GitHub
2. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
3. Go to **Pages** > **Create a project**
4. Connect your GitHub repository
5. Configure build settings:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Node version:** 18 or higher
6. Click **Save and Deploy**

Your blog will be deployed automatically! Every push to your repository will trigger a new deployment.

### Option 2: Using Wrangler CLI

```bash
# Install Wrangler
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy
npm run build
wrangler pages publish dist --project-name=personal-blog
```

## Customization

### Change Site Title & Description

Edit the content in `src/pages/index.astro`:

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

## Technologies Used

- [Astro](https://astro.build) - Static Site Generator
- [TypeScript](https://www.typescriptlang.org/) - Type Safety
- [Cloudflare Pages](https://pages.cloudflare.com/) - Hosting & Deployment

## License

MIT

## Support

For issues or questions about Astro, visit the [Astro Discord](https://astro.build/chat) or check the [documentation](https://docs.astro.build).

---

Built with ❤️ using Astro
