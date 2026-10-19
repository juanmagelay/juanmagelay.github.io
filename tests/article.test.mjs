// Checks for the revised Warcraft III analysis. Run npm run build first. Issue #3.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertBuilt } from './site-checks.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const page = join(dist, 'writing/warcraft-iii-ux-analysis/index.html');

test('the article is built', () => {
  assertBuilt(page);
});

const html = existsSync(page) ? readFileSync(page, 'utf8') : '';
const skip = !html;

// The article body only, without header or footer. MDX turns ' into ’, so it goes back to ' here.
const start = html.indexOf('class="prose"');
const body = html.slice(start, html.indexOf('</article>', start)).replaceAll('’', "'");
const stripTags = (fragment) => fragment.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const text = stripTags(body);

const HEADINGS = [
  ['h2', 'the-moment', 'The moment'],
  ['h2', 'ux-analysis', 'UX analysis'],
  ['h3', 'usability-vs-engageability', 'Usability vs. engageability'],
  ['h3', 'frustration-by-design-or-usability-problem', 'Frustration by design or usability problem?'],
  ['h3', 'genre-and-platform-considerations', 'Genre and platform considerations'],
  ['h2', 'my-take-as-a-ux-designer', 'My take as a UX Designer'],
  ['h2', 'what-this-taught-me', 'What this taught me'],
];

test('headings keep their text, ids and order', { skip }, () => {
  const found = [...body.matchAll(/<(h[23])\b[^>]*\bid="([^"]*)"[^>]*>([\s\S]*?)<\/\1>/g)].map(([, tag, id, inner]) => [
    tag,
    id,
    stripTags(inner),
  ]);
  assert.deepEqual(found, HEADINGS);
});

test('Age of Empires is introduced as AoE and never written AOE', { skip }, () => {
  const intro = text.indexOf('Age of Empires (AoE)');
  assert.ok(intro >= 0, 'Missing "Age of Empires (AoE)"');
  assert.equal(text.indexOf('AoE'), intro + 'Age of Empires ('.length, 'AoE is used before it is introduced');
  assert.doesNotMatch(text, /AOE/);
});

const LINKS = [
  ['Video Game and Simulation Development', 'https://unahur.edu.ar/licenciatura-en-desarrollo-de-videojuegos-y-simulaciones/'],
  ["Celia Hodent's Game UX course", 'https://ixdf.org/courses/game-ux-design-ultimate-guide'],
  ['Warcraft III: Reforged Patch 3.0', 'https://liquipedia.net/warcraft/Patch_3.0.0'],
  ["I'd like to know", '#contact'],
];
const links = [...body.matchAll(/<a\b[^>]*\bhref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map(([, href, inner]) => [
  stripTags(inner),
  href,
]);

for (const [label, href] of LINKS) {
  test(`the link "${label}" goes to ${href}`, { skip }, () => {
    assert.ok(
      links.some(([foundLabel, foundHref]) => foundLabel === label && foundHref === href),
      `No link "${label}" to ${href}`
    );
  });
}

test('the #contact target exists on the page', { skip }, () => {
  assert.match(html, /\bid="contact"/);
});

test('Ctrl is marked as a key and reads "Ctrl + a number key"', { skip }, () => {
  assert.match(body, /<kbd>Ctrl<\/kbd> \+ a number key/);
});

test('keys have a visible border in the published CSS', { skip }, () => {
  const linked = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(([, href]) =>
    readFileSync(join(dist, href), 'utf8')
  );
  const inline = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map(([, css]) => css);
  assert.match([...linked, ...inline].join('\n'), /\.prose kbd\s*\{[^}]*border:\s*1px solid/);
});

test('key ideas are emphasized', { skip }, () => {
  for (const phrase of ['usability', 'frustration by design']) {
    assert.ok(body.includes(`<em>${phrase}</em>`), `Not in italics: ${phrase}`);
  }
  for (const sentence of [
    "The challenge was by design, but the way I discovered it wasn't.",
    "The gap I'd flag is how the limit is communicated.",
    'usability and engageability do different jobs',
  ]) {
    assert.ok(body.includes(`<strong>${sentence}</strong>`), `Not in bold: ${sentence}`);
  }
});

test('the altar image alt names the Altar of Darkness', { skip }, () => {
  assert.match(body, /alt="[^"]*The Altar of Darkness is on the left\.[^"]*"/);
});
