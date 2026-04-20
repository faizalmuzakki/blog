import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getPublishedPosts } from '../lib/db';

export const GET: APIRoute = async ({ site, locals }) => {
  const db = (locals as App.Locals).runtime.env.DB;
  const posts = (await getPublishedPosts(db)).slice(0, 20);
  return rss({
    title: 'Blog',
    description: 'Latest posts',
    site: site ?? 'http://localhost:4321',
    items: posts.map((p) => ({
      title: p.title,
      link: `/blog/${p.slug}`,
      description: p.description,
      pubDate: new Date(p.createdAt),
    })),
  });
};
