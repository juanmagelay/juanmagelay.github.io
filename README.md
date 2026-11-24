# Juan Manuel Gelay: portfolio site

Source code of my portfolio site: https://juanmagelay.github.io

## Status

Pre-launch. A game UX analysis of Warcraft III: Reign of Chaos, in three parts, is live in English, Spanish and Portuguese. Hurlinstein3D, a game from my degree, is playable at /games/hurlinstein3d/. Escape de la Naranja, my horror game on Roblox, has its page at /games/escape-de-la-naranja/. Product case studies are in progress.

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

`npm test` checks the built site in `dist/`: alt text on every image, no em or en dashes in the copy, canonical URLs and the CV links. It also checks that every page exists in English, Spanish and Portuguese, with the language switch, `hreflang` links and internal links that work. It also checks the design system: fonts served from the site, the palette, AA contrast in both themes, colors written only in the tokens, no shadows or gradients, a visible focus ring and 44px buttons. Run it after `npm run build`. The deploy workflow runs it too and stops the deploy if a check fails.

## Structure

```
src/site.config.mjs        personal data: name, email, links, CV paths
src/i18n.mjs               languages (en, es, pt), interface copy and path helpers
src/content/writing/       posts, one MDX file each, published at /writing/<file name>/
src/content/writing/es/    Spanish translations, published at /es/writing/<file name>/ (pt/ for Portuguese)
src/content/games/         game pages, one MDX file each, published at /games/<file name>/ (es/ and pt/ for translations)
src/pages/[...lang]/       the /writing and /games lists and each post and game page, per language
src/lib/                   first-figure.mjs: each post's first image for its thumbnail; posts.ts and games.ts: posts and games per language
public/games/<slug>/game/  the copy of each game that runs in the browser, published as it is (see Update a game)
src/assets/games/          images, optimized at build time
src/assets/icons/          icons from Material Symbols Rounded and their license
src/components/            header, footer, button, page head, spec list, fact sheet, figure, copy email, row list
src/styles/                design tokens (tokens.css) and global styles
src/assets/fonts/          font files and their licenses
design/templates/          design system reference: tokens, components and page templates
integrations/              build guard
tests/                     checks for the built site (npm test)
.github/workflows/         deploy to GitHub Pages
```

## Update a game

Each game that runs in the browser is a copy of its own repo, made from this repo. The two repos are never connected: no Actions, tokens, deploy keys, secrets or submodules. The copy is published as it is, without passing through Astro, and is never edited here: a change goes to the game's repo first.

1. Check the game on its `main` branch.
2. Copy it from `main` as committed, not from the working folder. From the root of this repo:

   ```sh
   SRC="<local-path-to-Hurlinstein3D>"
   DEST=public/games/hurlinstein3d
   rm -rf "$DEST/game" && mkdir -p "$DEST/game"
   git -C "$SRC" archive main index.html lib js assets | tar -x -C "$DEST/game"
   git -C "$SRC" log -1 --format="%H %cs %s" main > "$DEST/game/SOURCE.txt"
   ```

   Deleting `game/` first makes files removed from the game disappear here too.
3. Run `npm run build` and `npm test` (they check that the build publishes the copy without changing a byte), try it with `npm run preview`, and commit.

## Licenses

- Code: MIT, see `LICENSE`.
- Content is not covered by the MIT license: texts, images and the CV are all rights reserved.
- Warcraft III screenshots and box art belong to Blizzard Entertainment and are shown for analysis.
- Fonts: SIL Open Font License 1.1, see the `OFL.txt` file in each folder of `src/assets/fonts/`.
- Icons: Material Symbols by Google, Apache License 2.0, see `src/assets/icons/LICENSE.txt`.
