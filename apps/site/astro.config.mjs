import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';

/**
 * `base` and `content` are supplied via env vars set by the CLI:
 *   KT_CONTENT_DIR   — absolute path to the content repo
 *   KT_BASE_PATH     — Pages base path (e.g. "/knowledge-test-kit/" or "/")
 *   KT_INCLUDE_DRAFT — "1" to include draft-status questions
 */
const base = process.env.KT_BASE_PATH || '/';
const siteUrl = process.env.KT_SITE_URL || `http://localhost:4321${base === '/' ? '' : base}`;

export default defineConfig({
  base,
  site: siteUrl,
  output: 'static',
  trailingSlash: 'ignore',
  integrations: [react(), mdx()],
  vite: {
    define: {
      'import.meta.env.KT_BANK_ID': JSON.stringify(process.env.KT_BANK_ID || 'demo-bank'),
      'import.meta.env.KT_INCLUDE_DRAFT': JSON.stringify(process.env.KT_INCLUDE_DRAFT || ''),
      'import.meta.env.KT_BASE_PATH': JSON.stringify(base),
    },
  },
});
