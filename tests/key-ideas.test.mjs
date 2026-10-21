// Every post shows the short idea of each paragraph in bold, the same way in the three languages. Issue #13.
// Which phrase goes in bold is the PO's call; these checks cover the rules around it. Run npm run build first.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertBuilt } from './site-checks.mjs';
import { LANGS, localizePath } from '../src/i18n.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const originals = readdirSync(join(root, 'src/content/writing')).filter((name) => /\.mdx?$/.test(name));

const MAX_WORDS = 15;

const decode = (text) =>
  text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
const stripTags = (fragment) => decode(fragment.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

// The article body only, without header or footer.
function articleBody(html) {
  const start = html.indexOf('class="prose"');
  return html.slice(start, html.indexOf('</article>', start));
}

// Body paragraphs as HTML. Captions, list items and the credits are not paragraphs here.
const paragraphs = (body) => [...body.matchAll(/<p>([\s\S]*?)<\/p>/g)].map(([, inner]) => inner);
const bolds = (fragment) => [...fragment.matchAll(/<strong>([\s\S]*?)<\/strong>/g)].map(([, inner]) => stripTags(inner));

// A label such as "Keep:" can open a paragraph; it is not the paragraph's idea.
function ideas(paragraph) {
  const all = bolds(paragraph);
  return paragraph.startsWith('<strong>') && all[0]?.endsWith(':') ? all.slice(1) : all;
}

const wordCount = (text) => text.split(/\s+/).filter(Boolean).length;

function misplacedBolds(body) {
  const inHeadings = [...body.matchAll(/<(h[23]|figcaption)\b[^>]*>([\s\S]*?)<\/\1>/g)]
    .filter(([, , inner]) => inner.includes('<strong>'))
    .map(([, tag, inner]) => `${tag}: ${stripTags(inner)}`);
  // MDX turns quotes into curly quotes, so a quote runs from “ to ”.
  const inQuotes = [...body.matchAll(/“[^”]*”/g)]
    .filter(([quote]) => quote.includes('<strong>'))
    .map(([quote]) => `quote: ${stripTags(quote)}`);
  return [...inHeadings, ...inQuotes];
}

// Astro 7 strips whitespace between inline elements, so a bold can stick to the word next to it.
const stuckBolds = (body) =>
  [...body.matchAll(/[\p{L}\p{N}]<strong>|<\/strong>[\p{L}\p{N}]/gu)].map((match) =>
    stripTags(body.slice(Math.max(0, match.index - 30), match.index + 30))
  );

// Each rule must fail on an example that breaks it.
test('the bold rules catch what they are meant to catch', () => {
  assert.deepEqual(ideas('<strong>Keep:</strong> the hero. It <strong>is a fair cost</strong>.'), ['is a fair cost']);
  assert.deepEqual(ideas('<strong>One idea.</strong> And <strong>another one</strong>.'), ['One idea.', 'another one']);
  assert.equal(misplacedBolds('<h2 id="x"><strong>Title</strong></h2>').length, 1);
  assert.equal(misplacedBolds('<figcaption>A <strong>caption</strong></figcaption>').length, 1);
  assert.equal(misplacedBolds('<p>Hodent writes that “attention is <strong>scarce</strong>”.</p>').length, 1);
  assert.equal(misplacedBolds('<p>She said “no”, and <strong>that was it</strong>.</p>').length, 0);
  assert.equal(stuckBolds('<p>word<strong>bold</strong> text</p>').length, 1);
  assert.equal(stuckBolds('<p>word <strong>bold</strong>text</p>').length, 1);
  assert.equal(stuckBolds('<p>word <strong>bold</strong>, text</p>').length, 0);
});

for (const name of originals) {
  const originalPath = `/writing/${name.replace(/\.mdx?$/, '')}/`;
  const counts = {};

  for (const lang of LANGS) {
    const path = localizePath(originalPath, lang);
    const file = join(dist, path, 'index.html');
    const html = existsSync(file) ? readFileSync(file, 'utf8') : '';
    const skip = !html;
    const body = articleBody(html);
    // Per section, the number of bolds of each paragraph that has any. Translations can add a paragraph
    // without bold, such as the note that quotes are our own translation.
    counts[lang] = body
      .split(/<h[23]\b/)
      .map((section) =>
        paragraphs(section)
          .map((paragraph) => bolds(paragraph).length)
          .filter(Boolean)
      );

    test(`${path} is built`, () => {
      assertBuilt(file);
    });

    test(`${path}: each paragraph has at most one idea in bold`, { skip }, () => {
      const crowded = paragraphs(body)
        .map(ideas)
        .filter((found) => found.length > 1);
      assert.deepEqual(crowded, []);
    });

    test(`${path}: each idea in bold has ${MAX_WORDS} words or fewer`, { skip }, () => {
      const long = paragraphs(body)
        .flatMap(ideas)
        .filter((idea) => wordCount(idea) > MAX_WORDS);
      assert.deepEqual(long, []);
    });

    test(`${path}: no bold in headings, captions or quotes`, { skip }, () => {
      assert.deepEqual(misplacedBolds(body), []);
    });

    test(`${path}: no bold sticks to the word next to it`, { skip }, () => {
      assert.deepEqual(stuckBolds(body), []);
    });
  }

  test(`${originalPath}: the paragraphs in bold match in the three languages, section by section`, { skip: !counts.en.length }, () => {
    for (const lang of LANGS.filter((lang) => lang !== 'en')) {
      assert.deepEqual(counts[lang], counts.en, `${lang} differs from en (per section, the bolds of each paragraph)`);
    }
  });
}
