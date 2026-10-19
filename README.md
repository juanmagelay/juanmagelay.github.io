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
- Bricolage Grotesque, Schibsted Grotesk and JetBrains Mono, self-hosted from the Google Fonts files (SIL Open Font License 1.1)
- GitHub Pages, deployed with GitHub Actions

## Run locally

Requires Node 22.12 or later.

```sh
npm ci
npm run dev
```

`npm run build` fails while any placeholder remains or a CV file is missing, so unfinished content never goes live. For a local test build only: `SKIP_PUBLISH_GUARD=1 npm run build`.

`npm test` checks the built site in `dist/`: alt text on every image, no em or en dashes in the copy, canonical URLs and the CV links. It also checks the design system: fonts served from the site, the palette, AA contrast in both themes, colors written only in the tokens, no shadows or gradients, a visible focus ring and 44px buttons. Run it after `npm run build`. The deploy workflow runs it too and stops the deploy if a check fails.

## Structure

```
src/site.config.mjs        personal data: name, email, links, CV paths
src/content/games/         /games pages, one MDX file each
src/pages/games/           the page for each post (/games/ redirects to /writing/)
src/pages/writing/         every post, newest first, with its first image as thumbnail
src/lib/                   first-figure.mjs: finds each post's first image for its thumbnail
src/assets/games/          images, optimized at build time
src/components/            header, footer, button, page head, spec list, fact sheet, figure, copy email, row list
src/styles/                design tokens (tokens.css) and global styles
src/assets/fonts/          font files and their licenses
design/templates/          design system reference: tokens, components and page templates
integrations/              build guard
tests/                     checks for the built site (npm test)
.github/workflows/         deploy to GitHub Pages
```

## Licenses

- Code: MIT, see `LICENSE`.
- Content is not covered by the MIT license: texts, images and the CV are all rights reserved.
- Warcraft III screenshots and box art belong to Blizzard Entertainment and are shown for analysis.
- Fonts: SIL Open Font License 1.1, see the `OFL.txt` file in each folder of `src/assets/fonts/`.
