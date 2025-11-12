import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  site: 'https://yourdomain.com', // Update this with your Cloudflare Pages URL
  output: 'server', // SSR mode for dynamic content and authentication
  adapter: cloudflare({
    platformProxy: {
      enabled: true
    }
  }),
});
