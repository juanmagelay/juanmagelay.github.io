// The revised text of both Warcraft III posts, in the three languages. Issue #13. Run npm run build first.
// The wording is approved by the PO; these checks cover the headings, names and links that changed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertBuilt } from './site-checks.mjs';
import { LANGS, localizePath, ui } from '../src/i18n.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const PART_1 = '/writing/warcraft-iii-ux-analysis/';
const PART_2 = '/writing/warcraft-iii-cognitive-science-analysis/';
const PARTS = [PART_1, PART_2];

const fileFor = (part, lang) => join(dist, localizePath(part, lang), 'index.html');
const pages = Object.fromEntries(
  PARTS.flatMap((part) =>
    LANGS.map((lang) => {
      const file = fileFor(part, lang);
      return [`${lang}${part}`, existsSync(file) ? readFileSync(file, 'utf8') : ''];
    })
  )
);
const page = (part, lang) => pages[`${lang}${part}`];

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
const articleBody = (html) => {
  const start = html.indexOf('class="prose"');
  return straighten(html.slice(start, html.indexOf('</article>', start)));
};
const headings = (html) => [...articleBody(html).matchAll(/<(h[23])\b[^>]*>([\s\S]*?)<\/\1>/g)].map(([, , inner]) => stripTags(inner));
const specValue = (html, label) =>
  stripTags(html.match(new RegExp(`<dt\\b[^>]*>${label}</dt>\\s*<dd\\b[^>]*>([\\s\\S]*?)</dd>`))?.[1] ?? '');
const linksIn = (fragment) =>
  [...fragment.matchAll(/<a\b[^>]*\bhref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map(([, href, inner]) => [stripTags(inner), href]);

for (const part of PARTS) {
  for (const lang of LANGS) {
    test(`${localizePath(part, lang)} is built`, () => {
      assertBuilt(fileFor(part, lang));
    });
  }
}

// Scenario: los títulos cambiados se ven en cada idioma, en su lugar. The position counts h2 and h3 from the top.
const RENAMED = [
  [PART_1, 'es', 0, 'El momento', 'Tres géneros en un solo juego'],
  [PART_1, 'es', 2, 'Usabilidad vs. enganche', 'Usabilidad y engagement'],
  [PART_1, 'es', 6, 'Lo que me enseñó', 'Lo que me enseñó analizar la experiencia del jugador'],
  [PART_2, 'es', 9, 'Lo que me enseñó', 'Lo que me enseñó analizar el juego desde la perspectiva cognitiva'],
  [PART_1, 'en', 0, 'The moment', 'Three genres in one game'],
  [PART_1, 'en', 2, 'Usability vs. engageability', 'Usability and engageability'],
  [PART_1, 'en', 6, 'What this taught me', 'What analyzing the player experience taught me'],
  [PART_2, 'en', 9, 'What this taught me', 'What analyzing the game from a cognitive perspective taught me'],
  [PART_1, 'pt', 0, 'O momento', 'Três gêneros em um só jogo'],
  [PART_1, 'pt', 2, 'Usabilidade vs. engajamento', 'Usabilidade e engajamento'],
  [PART_1, 'pt', 6, 'O que isso me ensinou', 'O que analisar a experiência do jogador me ensinou'],
  [PART_2, 'pt', 9, 'O que isso me ensinou', 'O que analisar o jogo pela perspectiva cognitiva me ensinou'],
];

for (const [part, lang, position, before, after] of RENAMED) {
  const html = page(part, lang);
  test(`${localizePath(part, lang)}: "${before}" is now "${after}"`, { skip: !html }, () => {
    const found = headings(html);
    assert.ok(!found.includes(before), `"${before}" is still a heading`);
    assert.equal(found[position], after);
  });
}

// Scenario: los nombres y términos se leen igual en todo el post.
const AOE = { en: 'Age of Empires I and II (AoE)', es: 'Age of Empires I y II (AoE)', pt: 'Age of Empires I e II (AoE)' };

for (const part of PARTS) {
  for (const lang of LANGS) {
    const html = page(part, lang);
    test(`${localizePath(part, lang)}: Age of Empires is introduced as "${AOE[lang]}"`, { skip: !html }, () => {
      const text = stripTags(articleBody(html));
      assert.ok(text.includes(AOE[lang]), `Missing "${AOE[lang]}"`);
      assert.ok(!text.includes('Age of Empires (AoE)'), 'Still says "Age of Empires (AoE)"');
    });
  }
}

test('the Spanish part 1 says engagement, never enganche', { skip: !page(PART_1, 'es') }, () => {
  const html = page(PART_1, 'es');
  assert.match(html, /engagement/);
  assert.doesNotMatch(html, /enganche/i);
});

const TYPES = { es: 'Análisis de UX de videojuegos', pt: 'Análise de UX de games' };

for (const part of PARTS) {
  for (const [lang, type] of Object.entries(TYPES)) {
    const html = page(part, lang);
    test(`${localizePath(part, lang)}: the type reads "${type}"`, { skip: !html }, () => {
      assert.equal(specValue(html, ui[lang].meta.type), type);
    });
  }
}

// Scenario: el link de contacto lleva al contacto del sitio. A path, so Medium's importer makes it absolute.
const CONTACT = { en: "I'd like to know", es: 'Me gustaría saberlo', pt: 'Quero saber' };

for (const part of PARTS) {
  for (const lang of LANGS) {
    const html = page(part, lang);
    const href = `${localizePath(part, lang)}#contact`;
    test(`${localizePath(part, lang)}: "${CONTACT[lang]}" goes to ${href}`, { skip: !html }, () => {
      assert.ok(
        linksIn(articleBody(html)).some(([label, found]) => label === CONTACT[lang] && found === href),
        `No link "${CONTACT[lang]}" to ${href}`
      );
      assert.match(html, /\bid="contact"/);
    });
  }
}
