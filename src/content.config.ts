import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// /games holds three kinds of work, each with a visible status.
const games = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/games' }),
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

export const collections = { games };
