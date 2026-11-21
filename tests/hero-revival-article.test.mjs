// Checks for part 3 of the Warcraft III analysis and its links with parts 1 and 2, in the three languages.
// Run npm run build first. The wording is approved by the PO; these checks cover titles, headings, links and images.
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
const PART_3 = '/writing/warcraft-iii-hero-revival-analysis/';

const fileFor = (part, lang) => join(dist, localizePath(part, lang), 'index.html');
const read = (part, lang) => (existsSync(fileFor(part, lang)) ? readFileSync(fileFor(part, lang), 'utf8') : '');

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
const attribute = (tag, name) => decode(tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1] ?? '');

for (const lang of LANGS) {
  test(`${localizePath(PART_3, lang)} is built`, () => {
    assertBuilt(fileFor(PART_3, lang));
  });
}

// Scenario: la tercera parte tiene su propia página en cada idioma.
const TITLES = {
  en: 'What reviving a hero really cost in Warcraft III (part 3)',
  es: 'Lo que costaba de verdad revivir a un héroe en Warcraft III (parte 3)',
  pt: 'O que custava de verdade reviver um herói em Warcraft III (parte 3)',
};
const CONTEXT = { en: 'IxDF Game UX course', es: 'Curso de Game UX de IxDF', pt: 'Curso de Game UX da IxDF' };
const CREDITS = {
  en: 'Warcraft III screenshots and art © Blizzard Entertainment, shown here for analysis.',
  es: 'Capturas y arte de Warcraft III © Blizzard Entertainment, mostrados aquí con fines de análisis.',
  pt: 'Capturas de tela e arte de Warcraft III © Blizzard Entertainment, exibidas aqui para fins de análise.',
};

for (const lang of LANGS) {
  const html = read(PART_3, lang);
  test(`${localizePath(PART_3, lang)} shows its title, type, context and credits`, { skip: !html }, () => {
    assert.equal(stripTags(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? ''), TITLES[lang]);
    assert.equal(specValue(html, ui[lang].meta.type), ui[lang].types.analysis);
    assert.equal(specValue(html, ui[lang].meta.context), CONTEXT[lang]);
    assert.equal(stripTags(html.match(/<p\b[^>]*class="[^"]*\barticle-credits\b[^"]*"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? ''), CREDITS[lang]);
  });
}

// Scenario: las secciones siguen el orden del artículo aprobado.
const HEADINGS = {
  en: [
    ['h2', 'The moment'],
    ['h2', 'Attention, memory and cognitive load'],
    ['h3', 'Too much on screen'],
    ['h3', 'Two places at once'],
    ['h3', 'Shortcuts under pressure'],
    ['h2', 'Usability and motivation analysis'],
    ['h3', 'Challenge or friction?'],
    ['h3', "Progress I couldn't see"],
    ['h2', 'My take as a UX Designer'],
    ['h2', 'What analyzing one moment in depth taught me'],
    ['h2', 'Sources'],
  ],
  es: [
    ['h2', 'El momento'],
    ['h2', 'Atención, memoria y carga cognitiva'],
    ['h3', 'Demasiado en pantalla'],
    ['h3', 'Dos lugares a la vez'],
    ['h3', 'Atajos bajo presión'],
    ['h2', 'Análisis de usabilidad y motivación'],
    ['h3', '¿Desafío o fricción?'],
    ['h3', 'El progreso que no veía'],
    ['h2', 'Mi mirada como UX Designer'],
    ['h2', 'Lo que me enseñó analizar un momento en profundidad'],
    ['h2', 'Fuentes'],
  ],
  pt: [
    ['h2', 'O momento'],
    ['h2', 'Atenção, memória e carga cognitiva'],
    ['h3', 'Coisa demais na tela'],
    ['h3', 'Dois lugares ao mesmo tempo'],
    ['h3', 'Atalhos sob pressão'],
    ['h2', 'Análise de usabilidade e motivação'],
    ['h3', 'Desafio ou atrito?'],
    ['h3', 'O progresso que eu não via'],
    ['h2', 'Minha visão como UX Designer'],
    ['h2', 'O que analisar um momento a fundo me ensinou'],
    ['h2', 'Fontes'],
  ],
};

for (const lang of LANGS) {
  const html = read(PART_3, lang);
  test(`${localizePath(PART_3, lang)}: headings follow the approved article, in order`, { skip: !html }, () => {
    const found = [...articleBody(html).matchAll(/<(h[23])\b[^>]*>([\s\S]*?)<\/\1>/g)].map(([, tag, inner]) => [tag, stripTags(inner)]);
    assert.deepEqual(found, HEADINGS[lang]);
  });
}

// Scenario: la tercera parte enlaza a las partes 1 y 2, y su link de contacto lleva al contacto del sitio.
const LINKS = {
  en: [
    ['The first part', PART_1],
    ['the second', PART_2],
    ["I'd like to know", `${PART_3}#contact`],
  ],
  es: [
    ['La primera parte', PART_1],
    ['la segunda', PART_2],
    ['Me gustaría saberlo', `${PART_3}#contact`],
  ],
  pt: [
    ['A primeira parte', PART_1],
    ['a segunda', PART_2],
    ['Quero saber', `${PART_3}#contact`],
  ],
};

for (const lang of LANGS) {
  const html = read(PART_3, lang);
  for (const [label, target] of LINKS[lang]) {
    const href = localizePath(target, lang);
    test(`${localizePath(PART_3, lang)}: the link "${label}" goes to ${href}`, { skip: !html }, () => {
      assert.ok(
        linksIn(articleBody(html)).some(([foundLabel, foundHref]) => foundLabel === label && foundHref === href),
        `No link "${label}" to ${href}`
      );
    });
  }

  test(`${localizePath(PART_3, lang)}: the #contact target exists on the page`, { skip: !html }, () => {
    assert.match(html, /\bid="contact"/);
  });
}

// Scenario: la parte 2 termina con un link a la parte 3, como la parte 1 con la parte 2.
const NEXT_PART = {
  en: ['part 3', 'You can keep reading another analysis of the game in part 3, focused on a single moment: reviving a hero mid-fight.'],
  es: ['parte 3', 'Podés seguir leyendo otro análisis del juego en la parte 3, centrado en un solo momento: revivir a un héroe en plena pelea.'],
  pt: ['parte 3', 'Você pode continuar lendo outra análise do jogo na parte 3, focada num único momento: reviver um herói no meio da luta.'],
};

for (const lang of LANGS) {
  const html = read(PART_2, lang);
  const [label, sentence] = NEXT_PART[lang];
  const href = localizePath(PART_3, lang);
  test(`${localizePath(PART_2, lang)}: "${label}" goes to ${href}`, { skip: !html }, () => {
    const body = articleBody(html);
    assert.ok(
      linksIn(body).some(([foundLabel, foundHref]) => foundLabel === label && foundHref === href),
      `No link "${label}" to ${href}`
    );
    assert.ok(stripTags(body).includes(sentence), `Missing: ${sentence}`);
  });
}

// Scenario: cada imagen tiene su alt descriptivo en cada idioma. The battle goes first: it is the thumbnail.
const IMAGES = {
  en: [
    ['warcraft-iii-reign-of-chaos-battle', ['large campaign battle', '2 minutes 59 seconds', '12 units']],
    [
      'warcraft-iii-reign-of-chaos-altar-reviving-hero',
      ['The Frozen Throne', 'Spanish version', 'Altar of Storms', "Revive Shadow Hunter (H), Zul'kis, level 1", '160 gold'],
    ],
  ],
  es: [
    ['warcraft-iii-reign-of-chaos-battle', ['gran batalla de campaña', '2 minutos y 59 segundos', '12 unidades']],
    [
      'warcraft-iii-reign-of-chaos-altar-reviving-hero',
      ['The Frozen Throne', 'versión en español', 'Altar de tormentas', "Revive Shadow Hunter (H), Zul'kis, nivel 1", '160 de oro'],
    ],
  ],
  pt: [
    ['warcraft-iii-reign-of-chaos-battle', ['grande batalha de campanha', '2 minutos e 59 segundos', '12 unidades']],
    [
      'warcraft-iii-reign-of-chaos-altar-reviving-hero',
      ['The Frozen Throne', 'versão em espanhol', 'Altar de tormentas', "Revive Shadow Hunter (H), Zul'kis, nível 1", '160 de ouro'],
    ],
  ],
};

for (const lang of LANGS) {
  const html = read(PART_3, lang);
  test(`${localizePath(PART_3, lang)}: the battle and the altar images have their alt text`, { skip: !html }, () => {
    const images = [...articleBody(html).matchAll(/<img\b[^>]*>/g)].map(([tag]) => ({
      file: attribute(tag, 'src').split('/').pop().split('.')[0],
      alt: attribute(tag, 'alt'),
    }));
    assert.deepEqual(
      images.map((image) => image.file),
      IMAGES[lang].map(([file]) => file)
    );
    for (const [index, [, fragments]] of IMAGES[lang].entries()) {
      const missing = fragments.filter((fragment) => !images[index].alt.includes(fragment));
      assert.deepEqual(missing, [], `Image ${index + 1}: the alt text misses these details`);
    }
  });
}

// Scenario: las teclas se marcan como teclas y los pilares de Hodent abren su párrafo como rótulo.
const LABELS = {
  en: ['Minimum workload:', 'Flexibility:'],
  es: ['Carga de trabajo mínima:', 'Flexibilidad:'],
  pt: ['Carga de trabalho mínima:', 'Flexibilidade:'],
};

for (const lang of LANGS) {
  const html = read(PART_3, lang);
  test(`${localizePath(PART_3, lang)}: Ctrl is marked as a key twice`, { skip: !html }, () => {
    assert.equal([...articleBody(html).matchAll(/<kbd>Ctrl<\/kbd>/g)].length, 2);
  });

  test(`${localizePath(PART_3, lang)}: each usability pillar opens its paragraph as a label`, { skip: !html }, () => {
    const body = articleBody(html);
    for (const label of LABELS[lang]) {
      assert.ok(body.includes(`<p><strong>${label}</strong> `), `Not a label: ${label}`);
    }
  });
}

test('the English part 3 marks "Ctrl + a number key"', { skip: !read(PART_3, 'en') }, () => {
  assert.match(articleBody(read(PART_3, 'en')), /<kbd>Ctrl<\/kbd> \+ a number key/);
});

// Scenario: la lista de fuentes tiene las tres fuentes del artículo.
const SOURCES = [
  ['Hodent', '2017'],
  ['Baddeley', '1974'],
  ['Ryan', '2000'],
];
const SOURCES_ID = { en: 'sources', es: 'fuentes', pt: 'fontes' };

for (const lang of LANGS) {
  const html = read(PART_3, lang);
  test(`${localizePath(PART_3, lang)}: the sources list has Hodent, Baddeley and Hitch, and Ryan and Deci`, { skip: !html }, () => {
    const body = articleBody(html);
    const list = body.slice(body.indexOf(`id="${SOURCES_ID[lang]}"`)).match(/<ul\b[^>]*>([\s\S]*?)<\/ul>/)?.[1] ?? '';
    const items = [...list.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map(([, item]) => stripTags(item));
    assert.equal(items.length, SOURCES.length);
    for (const [author, year] of SOURCES) {
      assert.ok(
        items.some((item) => item.startsWith(`${author},`) && item.includes(`(${year})`)),
        `No source by ${author} (${year})`
      );
    }
  });
}

// Scenario: el texto respeta las reglas de estilo del sitio. Dashes are checked on every page by dist.test.mjs,
// and the Spanish and Portuguese buzzwords by i18n.test.mjs.
const BUZZWORDS = ['passionate', 'leverage', 'seamless', 'empower', 'innovative', 'delightful', 'cutting-edge'];

test('the English part 3 uses none of the banned buzzwords', { skip: !read(PART_3, 'en') }, () => {
  const text = stripTags(articleBody(read(PART_3, 'en'))).toLowerCase();
  assert.deepEqual(
    BUZZWORDS.filter((word) => new RegExp(`\\b${word}`).test(text)),
    []
  );
});
