import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || 'http://localhost:4321',
  output: 'server', // SSR mode for dynamic content and authentication
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
  }),
  integrations: [
    sitemap({
      // SSR mode: routes aren't statically known, so list pages explicitly.
      // Extend this array as you add new public routes.
      customPages: [`${process.env.PUBLIC_SITE_URL || 'http://localhost:4321'}/`],
    }),
  ],
});
