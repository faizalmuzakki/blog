import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  site: 'https://yourdomain.com', // Update this with your Cloudflare Pages URL
  output: 'static', // Static site generation for Cloudflare Pages
  adapter: cloudflare(),
});
