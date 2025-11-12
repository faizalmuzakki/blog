-- Seed data for Personal Blog

-- Insert default admin user
-- Username: admin
-- Password: admin123
-- Note: Run 'node generate-password.js admin123' to generate a new hash
INSERT OR IGNORE INTO users (id, username, password_hash)
VALUES (1, 'admin', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy');

-- Insert sample blog posts
INSERT OR IGNORE INTO posts (title, slug, description, content, is_private, created_at)
VALUES
(
  'Welcome to My Blog',
  'welcome',
  'My first blog post - introducing myself and what this blog is about',
  '# Welcome!

Hello and welcome to my personal blog! I''m excited to share my thoughts, experiences, and learnings with you.

## What This Blog Is About

This blog is my personal space where I''ll be writing about:

- Technology and programming
- Personal projects and experiments
- Thoughts on software development
- Life experiences and lessons learned

## Why I Started This Blog

I wanted a place to document my journey and share knowledge with others. Writing helps me clarify my thoughts and hopefully, my posts can help or inspire someone else.

## What to Expect

I''ll be posting regularly (or at least trying to!). Some posts will be:

- **Technical tutorials** - Step-by-step guides
- **Project showcases** - Things I''ve built
- **Personal reflections** - Thoughts on various topics
- **Learning notes** - Things I''ve discovered

Thanks for stopping by, and I hope you find something interesting here!

---

*Feel free to reach out if you have any questions or just want to chat.*',
  0,
  datetime('2024-11-10 10:00:00')
),
(
  'Building My Personal Blog with Astro',
  'building-my-blog',
  'How I built this blog using Astro, Cloudflare D1, and deployed it to Cloudflare Pages',
  '# Building My Personal Blog

Today I built this blog using **Astro**, **Cloudflare D1**, and deployed it to **Cloudflare Pages**. Here''s how I did it!

## Why Astro?

Astro is perfect for content-focused websites because:

1. **Fast by default** - Ships zero JavaScript by default
2. **Great DX** - Easy to work with and understand
3. **Flexible** - Use any UI framework you want (or none!)
4. **SSR Support** - Server-side rendering for dynamic content

## Key Features

I built in some key features that I wanted:

### Public and Private Posts

The blog supports both public and private posts:

- **Public posts** appear in the main blog feed
- **Private posts** are password-protected and don''t appear in listings

This is great for drafts or personal notes that I might want to share with specific people.

### Admin Dashboard

I created an admin dashboard where I can:

- Create new posts
- Edit existing posts
- Delete posts
- Toggle post visibility (public/private)

### Database-Backed

All posts are stored in Cloudflare D1, making it easy to:

- Manage content dynamically
- Query and filter posts
- Update content without redeploying

## The Tech Stack

- **Astro** - SSR framework
- **TypeScript** - For type safety
- **Cloudflare D1** - Serverless SQL database
- **Cloudflare Pages** - Hosting and deployment

## Next Steps

Some things I want to add in the future:

- [ ] Tags and categories
- [ ] Search functionality
- [ ] Rich text editor
- [ ] Image uploads
- [ ] Dark mode

Stay tuned for updates!',
  0,
  datetime('2024-11-11 14:00:00')
),
(
  'My Private Thoughts',
  'private-thoughts',
  'A private post that requires a password to view',
  '# Private Post

This is a **private post** that won''t appear in the public blog listing.

## How It Works

To view this post, you need to enter the password: `mypassword`

This is useful for:

- **Draft posts** that aren''t ready for public viewing
- **Personal notes** you want to keep semi-private
- **Content for specific audiences** that you share the link with

## Privacy Note

Keep in mind this is client-side password protection, so it''s not suitable for truly sensitive content. It''s more of a "soft gate" to keep casual visitors from seeing certain posts.

For truly private content, you should use proper authentication on the server side or keep the content completely offline.

## Use Cases

Some good use cases for private posts:

1. Work-in-progress drafts
2. Personal journal entries you might share with friends
3. Technical notes that need review before publishing
4. Experimental content you''re not sure about yet

---

*This is just an example of a private post. Feel free to delete or modify it!*',
  1,
  datetime('2024-11-09 09:00:00')
);

-- Update the private post with a password
UPDATE posts SET private_password = 'mypassword' WHERE slug = 'private-thoughts';
