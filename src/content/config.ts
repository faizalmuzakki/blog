import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    heroImage: z.string().optional(),
    isPrivate: z.boolean().default(false), // Public by default
    privatePassword: z.string().optional(), // Password for private posts
  }),
});

export const collections = { blog };
