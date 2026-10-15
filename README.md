# Juan Manuel Gelay: portfolio site

Source code of my portfolio site: https://juanmagelay.github.io

## Status

Pre-launch. One page is live: a game UX analysis of Warcraft III: Reign of Chaos. Product case studies are in progress.

## My role

I wrote the analysis, defined the site's structure and publishing rules, and set up and published the site myself.

## How AI was used

The initial scaffold was generated with Claude (Anthropic) from my brief: page layout, components, design tokens, build guard and deploy workflow.

I reviewed the result in the browser, filled in the content and data, and made the editorial calls: what to publish, how to credit the images and which screenshots to use. I also used AI to help write and proofread the analysis text.

## Stack

- Astro 7, static output
- MDX for long-form content
- Plain CSS with design tokens in `src/styles/tokens.css`, named after the Figma variables
- Atkinson Hyperlegible Next, self-hosted (SIL Open Font License 1.1)
- GitHub Pages, deployed with GitHub Actions

## Run locally

Requires Node 22.12 or later.

```sh
npm ci
npm run dev
```

`npm run build` fails while any placeholder remains or the CV file is missing, so unfinished content never goes live. For a local test build only: `SKIP_PUBLISH_GUARD=1 npm run build`.

## Structure

```
src/site.config.mjs        personal data: name, email, links, CV path
src/content/games/         /games pages, one MDX file each
src/assets/games/          images, optimized at build time
src/components/            header, footer, figure, game sheet, copy email
src/styles/tokens.css      design tokens
integrations/              build guard
.github/workflows/         deploy to GitHub Pages
```

## Licenses

- Code: MIT, see `LICENSE`.
- Content is not covered by the MIT license: texts, images and the CV are all rights reserved.
- Warcraft III screenshots and box art belong to Blizzard Entertainment and are shown for analysis.
- Font: SIL Open Font License 1.1, see `src/assets/fonts/atkinson-hyperlegible-next/OFL.txt`.
