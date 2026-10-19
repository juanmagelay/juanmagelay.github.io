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

export const collections = { writing, writingTranslations };
