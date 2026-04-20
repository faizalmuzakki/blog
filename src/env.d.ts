// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../.astro/types.d.ts" />
/// <reference types="@cloudflare/workers-types" />

declare namespace App {
  interface Locals {
    user: import('./lib/auth').User | null;
    csrfToken: string | null;
    runtime: {
      env: {
        DB: import('@cloudflare/workers-types').D1Database;
        GOOGLE_CLIENT_ID?: string;
        GOOGLE_CLIENT_SECRET?: string;
        PUBLIC_SITE_URL?: string;
        CLAUDE_API_URL?: string;
        CLAUDE_API_SECRET?: string;
        DEFAULT_LANGUAGE?: string;
      };
    };
  }
}
