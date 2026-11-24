import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Posts in /writing/: three kinds of work, each with a visible status. The English original of each post.
// Every post needs at least one <Figure>: the first one is its thumbnail in /writing/ (src/lib/first-figure.mjs).
const writing = defineCollection({
  loader: glob({ pattern: '*.{md,mdx}', base: './src/content/writing' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      type: z.enum(['playable', 'analysis', 'academic']),
      status: z.enum(['finished', 'prototype', 'in-development', 'academic']),
      context: z.string().optional(),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      game: z
        .object({
          name: z.string(),
          developer: z.string(),
          released: z.number(),
          genre: z.string(),
          platform: z.string().optional(),
        })
        .optional(),
      cover: image().optional(),
      coverAlt: z.string().optional(),
      ogImage: image().optional(),
      credits: z.string().optional(),
    }),
});

// Translations of each post: src/content/writing/<lang>/<same file name>, published at /<lang>/writing/<file name>/.
// They only hold the text. Dates, type, status, game facts and images come from the original (src/lib/posts.ts).
const writingTranslations = defineCollection({
  loader: glob({ pattern: '*/*.{md,mdx}', base: './src/content/writing' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    context: z.string().optional(),
    game: z
      .object({
        genre: z.string(),
        platform: z.string().optional(),
      })
      .optional(),
    coverAlt: z.string().optional(),
    credits: z.string().optional(),
  }),
});

// Games in /games/: the English original of each game page, published at /games/<file name>/. Issue #17.
// The image is the game's screenshot: the main image of its page, its og:image and its thumbnail in /games/.
// A game that runs in the browser is a copy in public/games/<file name>/game/, published as it is, never edited
// here: `play` is the path of its index.html, and logo and favicon are files of that copy.
// A game that runs elsewhere, such as on Roblox, has `playUrl` instead: its Play button is a link that opens there
// in a new tab, with `playLabel` and the note `playNote` under it. Its `icon` is the game's icon on that platform,
// optimized at build time; it is not pixel art. Issue #19.
// A game without `play` or `playUrl` gets its page with no Play button.
const games = defineCollection({
  loader: glob({ pattern: '*.{md,mdx}', base: './src/content/games' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      type: z.enum(['playable', 'academic', 'personal']),
      year: z.number(),
      image: image(),
      imageAlt: z.string(),
      logo: z.string().optional(),
      logoAlt: z.string().optional(),
      icon: image().optional(),
      iconAlt: z.string().optional(),
      favicon: z.string().optional(),
      play: z.string().optional(),
      playUrl: z.string().url().optional(),
      playLabel: z.string().optional(),
      playNote: z.string().optional(),
      repo: z.string().url().optional(),
    }),
});

// Translations of each game page: src/content/games/<lang>/<same file name>, published at /<lang>/games/<file name>/.
// They only hold the text. Everything else comes from the original (src/lib/games.ts).
const gamesTranslations = defineCollection({
  loader: glob({ pattern: '*/*.{md,mdx}', base: './src/content/games' }),
  schema: z.object({
    title: z.string().optional(),
    description: z.string(),
    imageAlt: z.string(),
    logoAlt: z.string().optional(),
    iconAlt: z.string().optional(),
    playLabel: z.string().optional(),
    playNote: z.string().optional(),
  }),
});

export const collections = { writing, writingTranslations, games, gamesTranslations };
