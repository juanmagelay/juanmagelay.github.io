// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import mdx from '@astrojs/mdx';
import publishGuard from './integrations/publish-guard.mjs';

// Fonts: official Google Fonts files, latin subset, self-hosted in src/assets/fonts/.
// The range is the one Google Fonts serves with the latin files.
const latin = [
  'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
];

export default defineConfig({
  // Repo name must be <username>.github.io so the site lives at the root (no `base`).
  // When you buy a domain later: change this value and add public/CNAME. Paths stay the same.
  site: 'https://juanmagelay.github.io',
  trailingSlash: 'always',

  integrations: [mdx(), publishGuard()],

  // Three voices of the design system: headings, text and metadata.
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Bricolage Grotesque',
      cssVariable: '--font-voice',
      fallbacks: ['system-ui', 'sans-serif'],
      options: {
        variants: [
          {
            src: ['./src/assets/fonts/bricolage-grotesque/normal.woff2'],
            weight: '200 800',
            style: 'normal',
            unicodeRange: latin,
          },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'Schibsted Grotesk',
      cssVariable: '--font-text',
      fallbacks: ['system-ui', 'sans-serif'],
      options: {
        variants: [
          {
            src: ['./src/assets/fonts/schibsted-grotesk/normal.woff2'],
            weight: '400 900',
            style: 'normal',
            unicodeRange: latin,
          },
          {
            src: ['./src/assets/fonts/schibsted-grotesk/italic.woff2'],
            weight: '400',
            style: 'italic',
            unicodeRange: latin,
          },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'JetBrains Mono',
      cssVariable: '--font-data',
      fallbacks: ['ui-monospace', 'monospace'],
      options: {
        variants: [
          {
            src: ['./src/assets/fonts/jetbrains-mono/normal.woff2'],
            weight: '400 800',
            style: 'normal',
            unicodeRange: latin,
          },
        ],
      },
    },
  ],

  redirects: {
    // Temporary: remove when the home page exists (#8).
    '/': '/games/warcraft-iii-ux-analysis/',
    // /games/ was published as a redirect, so it stays. The list of posts lives at /writing/.
    '/games/': '/writing/',
  },
});
