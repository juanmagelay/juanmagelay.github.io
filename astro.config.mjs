// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import mdx from '@astrojs/mdx';
import publishGuard from './integrations/publish-guard.mjs';

export default defineConfig({
  // Repo name must be <username>.github.io so the site lives at the root (no `base`).
  // When you buy a domain later: change this value and add public/CNAME. Paths stay the same.
  site: 'https://juanmagelay.github.io',
  trailingSlash: 'always',

  integrations: [mdx(), publishGuard()],

  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Atkinson Hyperlegible Next',
      cssVariable: '--font-sans',
      fallbacks: ['system-ui', 'sans-serif'],
      options: {
        variants: [
          {
            src: ['./src/assets/fonts/atkinson-hyperlegible-next/normal.woff2'],
            weight: '200 800',
            style: 'normal',
          },
          {
            src: ['./src/assets/fonts/atkinson-hyperlegible-next/italic.woff2'],
            weight: '200 800',
            style: 'italic',
          },
        ],
      },
    },
  ],

  // Temporary: the article is the only page. Remove each line when the real page exists.
  redirects: {
    '/': '/games/warcraft-iii-ux-analysis/',
    '/games/': '/games/warcraft-iii-ux-analysis/',
  },
});
