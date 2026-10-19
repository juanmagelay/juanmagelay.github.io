// Checks for part 2 of the Warcraft III analysis and its links with part 1. Run npm run build first. Issue #5.
// Part 1 keeps its headings, ids and order: tests/article.test.mjs checks that.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertBuilt } from './site-checks.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const PART_1 = '/writing/warcraft-iii-ux-analysis/';
const PART_2 = '/writing/warcraft-iii-cognitive-science-analysis/';

const pagePath = (sitePath) => join(dist, sitePath, 'index.html');
const readPage = (sitePath) => (existsSync(pagePath(sitePath)) ? readFileSync(pagePath(sitePath), 'utf8') : '');

test('part 2 is built', () => {
  assertBuilt(pagePath(PART_2));
});

const html = readPage(PART_2);
const part1 = readPage(PART_1);
const skip = !html || !part1;

// MDX turns quotes into curly quotes, so they go back to straight quotes here.
const straighten = (text) => text.replaceAll('’', "'").replaceAll('“', '"').replaceAll('”', '"');
const decode = (text) =>
  text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
const stripTags = (fragment) => decode(fragment.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
// The article body only, without header or footer.
const articleBody = (page) => {
  const start = page.indexOf('class="prose"');
  return straighten(page.slice(start, page.indexOf('</article>', start)));
};
const specValue = (page, label) =>
  stripTags(page.match(new RegExp(`<dt\\b[^>]*>${label}</dt>\\s*<dd\\b[^>]*>([\\s\\S]*?)</dd>`))?.[1] ?? '');
const linksIn = (fragment) =>
  [...fragment.matchAll(/<a\b[^>]*\bhref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map(([, href, inner]) => [stripTags(inner), href]);

const body = articleBody(html);

// Scenario: la segunda parte tiene su propia página.
test('part 2 shows its title, type and context', { skip }, () => {
  assert.equal(stripTags(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? ''), 'Thinking fast and slow in Warcraft III (part 2)');
  assert.equal(specValue(html, 'Type'), 'Game UX analysis');
  assert.equal(specValue(html, 'Context'), 'IxDF Game UX course');
});

// Scenario: las secciones siguen la consigna del curso.
const HEADINGS = [
  ['h2', 'two-ways-of-thinking', 'Two ways of thinking'],
  ['h2', 'managing-cognitive-load', 'Managing cognitive load'],
  ['h3', 'practice-before-pressure', 'Practice before pressure'],
  ['h2', 'attention-memory-and-learning', 'Attention, memory and learning'],
  ['h3', 'attention', 'Attention'],
  ['h3', 'memory', 'Memory'],
  ['h3', 'learning', 'Learning'],
  ['h2', 'mental-models-and-familiar-patterns', 'Mental models and familiar patterns'],
  ['h2', 'revisiting-what-i-would-improve', 'Revisiting what I would improve'],
  ['h2', 'what-this-taught-me', 'What this taught me'],
  ['h2', 'sources', 'Sources'],
];

test('part 2 headings follow the course brief, in order', { skip }, () => {
  const found = [...body.matchAll(/<(h[23])\b[^>]*\bid="([^"]*)"[^>]*>([\s\S]*?)<\/\1>/g)].map(([, tag, id, inner]) => [
    tag,
    id,
    stripTags(inner),
  ]);
  assert.deepEqual(found, HEADINGS);
});

// Scenario: las dos partes se enlazan entre sí.
const LINKS = [
  ['part 2', html, "Celia Hodent's Game UX course", 'https://ixdf.org/courses/game-ux-design-ultimate-guide'],
  ['part 2', html, 'The first part', PART_1],
  ['part 2', html, 'the first part', `${PART_1}#frustration-by-design-or-usability-problem`],
  ['part 2', html, "I'd like to know", '#contact'],
  ['part 1', part1, 'part 2', PART_2],
];

for (const [part, page, label, href] of LINKS) {
  test(`${part}: the link "${label}" goes to ${href}`, { skip }, () => {
    const found = linksIn(articleBody(page));
    assert.ok(
      found.some(([foundLabel, foundHref]) => foundLabel === label && foundHref === href),
      `No link "${label}" to ${href}`
    );
  });
}

test('the section part 2 links to exists in part 1', { skip }, () => {
  assert.match(part1, /\bid="frustration-by-design-or-usability-problem"/);
});

// Scenario: Sources lista las fuentes principales con un link legible.
const SOURCES = [
  ['Kahneman', '2011', 'https://www.amazon.com/Thinking-Fast-Slow-Daniel-Kahneman/dp/0374533555'],
  ['Hodent', '2017', 'https://www.amazon.com/Gamers-Brain-Neuroscience-Impact-Design/dp/1498775500'],
  ['Lane', '2005', 'https://www.ruf.rice.edu/~lane/papers/hidden_costs.pdf'],
  ['Cockburn', '2014', 'https://dl.acm.org/doi/10.1145/2659796'],
  ['Thompson', '2013', 'https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0075129'],
  ['Grossman', '2007', 'https://www.dgp.toronto.edu/~ravin/papers/chi2007_learninghotkeys.pdf'],
];

const sourcesList = body.slice(body.indexOf('id="sources"')).match(/<ul\b[^>]*>([\s\S]*?)<\/ul>/)?.[1] ?? '';
const sources = [...sourcesList.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map(([, item]) => ({
  text: stripTags(item),
  hrefs: linksIn(item).map(([, href]) => decode(href)),
}));

test('Sources lists the 6 main sources', { skip }, () => {
  assert.equal(sources.length, SOURCES.length);
});

for (const [author, year, href] of SOURCES) {
  test(`Sources includes ${author} (${year}) with a link to ${href}`, { skip }, () => {
    const source = sources.find((item) => item.text.startsWith(`${author},`));
    assert.ok(source, `No source by ${author}`);
    assert.ok(source.text.includes(`(${year})`), `${author} is not dated ${year}`);
    assert.ok(source.hrefs.includes(href), `${author} does not link to ${href}`);
  });
}

// Scenario: la parte 1 se identifica como parte 1 sin perder nada.
test('part 1 shows "(part 1)" in its title and the course without a lesson number', { skip }, () => {
  assert.equal(
    stripTags(part1.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? ''),
    'When strategy met RPG heroes: a UX look at Warcraft III (part 1)'
  );
  assert.equal(specValue(part1, 'Context'), 'IxDF Game UX course');
  assert.doesNotMatch(stripTags(part1), /lesson 1/i);
});

// Scenario: el texto respeta las reglas de estilo del sitio. Dashes are checked on every page by dist.test.mjs.
const BUZZWORDS = ['passionate', 'leverage', 'seamless', 'empower', 'innovative', 'delightful', 'cutting-edge'];

test('part 2 uses none of the banned buzzwords', { skip }, () => {
  const text = stripTags(body).toLowerCase();
  assert.deepEqual(
    BUZZWORDS.filter((word) => new RegExp(`\\b${word}`).test(text)),
    []
  );
});
