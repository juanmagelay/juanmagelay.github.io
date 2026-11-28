// Every image of an article, a game page or a case study opens enlarged when pressed, and only opens and closes.
// Issue #21. Run npm run build first. The viewer itself (open, close with the button, Esc or a press outside, focus
// back on the image) is PO validation in the browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertBuilt, isGameCopy, isRedirect, pathForFile } from './site-checks.mjs';
import { langFromPath, ui } from '../src/i18n.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));

const decode = (text) =>
  text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
const stripTags = (fragment) => decode(fragment.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
const attribute = (tag, name) => {
  const value = tag?.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
  return value === undefined ? undefined : decode(value);
};

function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.name.endsWith('.html') ? [path] : [];
  });
}

test('the site is built', () => {
  assertBuilt(dist);
});

const pages = existsSync(dist)
  ? htmlFiles(dist)
      .filter((file) => !isGameCopy(relative(dist, file)))
      .map((file) => ({ path: pathForFile(relative(dist, file)), html: readFileSync(file, 'utf8') }))
      .filter((page) => !isRedirect(page.html))
  : [];

// A post, a game or a case: /writing/x/, /games/x/ and /case-studies/x/, in each language.
const DETAIL = /^(?:\/(?:es|pt))?\/(?:writing|games|case-studies)\/[^/]+\/$/;
const LIST = /^(?:\/(?:es|pt))?\/(?:writing|games|case-studies)\/$/;
const details = pages.filter((page) => DETAIL.test(page.path));
const lists = pages.filter((page) => LIST.test(page.path));

const zoomLinks = (html) =>
  [...html.matchAll(/<a\b([^>]*\bdata-lightbox\b[^>]*)>([\s\S]*?)<\/a>/g)].map(([, attributes, inner]) => ({ tag: `<a${attributes}>`, inner }));

test('posts, games and case studies are built', () => {
  assert.ok(details.length >= 15, `Only ${details.length} detail pages`);
});

for (const { path, html } of details) {
  const lang = langFromPath(path);
  const t = ui[lang];
  const article = html.slice(html.indexOf('<article'), html.indexOf('</article>'));

  // Images that stay as they are: the game's pixel art logo, a frameless figure (a logo) and the video's poster.
  const fixed = [
    ...[...article.matchAll(/<img\b[^>]*class="[^"]*\bgame-logo\b[^"]*"[^>]*>/g)].map(([img]) => img),
    ...[...article.matchAll(/<figure\b[^>]*class="[^"]*\bfigure-frameless\b[^"]*"[^>]*>[\s\S]*?<\/figure>/g)].flatMap(([figure]) => figure.match(/<img\b[^>]*>/g) ?? []),
    ...[...article.matchAll(/<div\b[^>]*class="[^"]*\bvideo-frame\b[^"]*"[^>]*>[\s\S]*?<\/div>/g)].flatMap(([frame]) => frame.match(/<img\b[^>]*>/g) ?? []),
  ];
  const images = [...article.matchAll(/<img\b[^>]*>/g)].map(([img]) => img);
  const links = zoomLinks(article);

  test(`${path}: every image opens enlarged, except a logo and the video's poster`, () => {
    const wrapped = links.flatMap((link) => link.inner.match(/<img\b[^>]*>/g) ?? []);
    const expected = images.filter((img) => !fixed.includes(img));
    assert.ok(expected.length > 0, 'No images to enlarge');
    assert.deepEqual(wrapped, expected, 'An image does not open enlarged');
    assert.deepEqual(fixed.filter((img) => wrapped.includes(img)), [], 'A logo or a poster opens enlarged');
  });

  test(`${path}: each image opens its large version from the build, named for screen readers`, () => {
    for (const link of links) {
      const href = attribute(link.tag, 'href') ?? '';
      assert.match(href, /^\/_astro\/[^/]+\.webp$/, `Not a large version from the build: ${href}`);
      assert.ok(existsSync(join(dist, href)), `${href} is not in the build`);
      assert.ok(stripTags(link.inner).endsWith(t.enlargeImage), 'The link does not say it enlarges the image');
    }
  });

  test(`${path}: an enlarged image keeps its caption`, () => {
    const figures = [...article.matchAll(/<figure\b[^>]*class="[^"]*\bfigure\b[^"]*"[^>]*>([\s\S]*?)<\/figure>/g)].map(([, inner]) => inner);
    for (const figure of figures) {
      const link = zoomLinks(figure)[0];
      const caption = figure.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/)?.[1];
      if (!link) continue;
      assert.equal(attribute(link.tag, 'data-lightbox-caption'), caption === undefined ? undefined : stripTags(caption));
    }
  });

  // Scenario: la imagen ampliada se cierra con un botón en el idioma de la página.
  test(`${path}: one viewer, with Close in the page's language and no image until one opens`, () => {
    const dialogs = [...html.matchAll(/<dialog\b[^>]*\bdata-lightbox-dialog\b[^>]*>([\s\S]*?)<\/dialog>/g)];
    assert.equal(dialogs.length, 1, 'Expected one viewer');
    const [dialog, inner] = dialogs[0];
    assert.equal(attribute(dialog, 'aria-label'), t.enlargedImage);
    const close = inner.match(/<button\b[^>]*\bdata-lightbox-close\b[^>]*>([\s\S]*?)<\/button>/);
    assert.ok(close, 'No close button');
    assert.match(close[0], /class="[^"]*\bbutton\b/);
    assert.equal(stripTags(close[1]), t.closeImage);
    assert.doesNotMatch(inner, /<img\b/, 'The viewer holds an image before one opens');
  });
}

// Scenario: en los listados, la miniatura lleva al post, no se amplía.
for (const { path, html } of lists) {
  test(`${path}: thumbnails link to their page and do not open enlarged`, () => {
    assert.deepEqual(zoomLinks(html), []);
    assert.doesNotMatch(html, /\bdata-lightbox-dialog\b/);
  });
}

// The PO's call: the image only opens and closes, so the cursor is a link's, never a magnifier.
test('no image shows a zoom cursor', () => {
  const css = existsSync(join(dist, '_astro'))
    ? readdirSync(join(dist, '_astro'))
        .filter((name) => name.endsWith('.css'))
        .map((name) => readFileSync(join(dist, '_astro', name), 'utf8'))
        .join('\n')
    : '';
  assert.ok(css, 'No stylesheets in the build');
  assert.doesNotMatch(css, /cursor:\s*zoom-(?:in|out)/);
});
