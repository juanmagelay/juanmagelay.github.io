// Checks for the Case studies section and its first case, El Diablo y Florentino. Issue #21.
// The source checks run as they are; the rest read the built site, so run npm run build first.
// Editorial criteria (which phrase goes in bold, the translations, the captions) are PO validation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertBuilt, checkCanonical, findDashes, isGameCopy, isRedirect, pathForFile } from './site-checks.mjs';
import { CASE_STUDY_TAGS, LANGS, langFromPath, localizePath, ui } from '../src/i18n.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const casesDir = join(root, 'src/content/case-studies');
const SITE = 'https://juanmagelay.github.io';

const SLUG = 'el-diablo-y-florentino';
const CASE_PATH = `/case-studies/${SLUG}/`;
const VIDEO = 'https://www.youtube-nocookie.com/embed/FdFRlcLWDwI';

// The portfolio card and the section titles of the brief, as the English page must show them. The title and the
// description follow the PO's Spanish edit of the list, passed to English.
const CARD = {
  title: 'Are you investing or not? The business case for an indie game',
  dek: 'An investor deck containing the player research, the value proposition, the business model and the go-to-market plan for El Diablo y Florentino.',
  description: 'Turned a game concept into an investor-ready plan, starting with player research and ending at the break-even point.',
};
// The cost spreadsheet and the deck, shared to read. Without the owner's account ID (ouid) that Drive adds to links.
const SHEET = 'https://docs.google.com/spreadsheets/d/1tt_jnGyQ55GKvG5vBzZHoiVbqujkNIk7/edit?usp=sharing&rtpof=true&sd=true';
const DECK = 'https://docs.google.com/presentation/d/1WTQvPVHII-DF_kmZJftede-lear4T0SC/edit?usp=sharing&rtpof=true&sd=true';
const SECTIONS = [
  'Overview',
  'The challenge',
  'Market and player research',
  'Value proposition',
  'Business model',
  'Go to market',
  'Visual system',
  'Deck storytelling',
  'How I worked with AI',
  'Result',
  'What I learned',
  'Credits',
];

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
// /_astro/cover.n-r08oDv_1D3Vyx.webp -> cover: the source file, whatever the size or format.
const stem = (src) => (src ?? '').split('/').pop().split('.')[0];
const builtFile = (sitePath) => join(dist, sitePath, 'index.html');
const read = (sitePath) => (existsSync(builtFile(sitePath)) ? readFileSync(builtFile(sitePath), 'utf8') : '');
const headerOf = (html) => html.slice(html.indexOf('<header'), html.indexOf('</header>'));
// The article body only, without the head, the credits line or the footer.
const bodyOf = (html) => {
  const start = html.indexOf('class="prose"');
  return start < 0 ? '' : html.slice(start, html.indexOf('</article>', start));
};

// Source checks: they need no build.

const originals = existsSync(casesDir) ? readdirSync(casesDir).filter((name) => /\.mdx?$/.test(name)) : [];

test('the first case study exists', () => {
  assert.ok(originals.includes(`${SLUG}.mdx`), `Missing src/content/case-studies/${SLUG}.mdx`);
});

// Scenario: cada caso existe en los tres idiomas.
test('every case study has a Spanish and a Portuguese version', () => {
  const missing = originals.flatMap((name) =>
    ['es', 'pt'].filter((lang) => !existsSync(join(casesDir, lang, name))).map((lang) => `src/content/case-studies/${lang}/${name}`)
  );
  assert.deepEqual(missing, []);
});

test('every tag has a name in each language', () => {
  for (const lang of LANGS) {
    assert.deepEqual(Object.keys(ui[lang].tags), [...CASE_STUDY_TAGS], `${lang}: tag names differ from CASE_STUDY_TAGS`);
    assert.ok(ui[lang].tagsLabel, `${lang}: no label for the tag list`);
  }
});

test('the case study files have no em or en dashes', () => {
  const files = [`${SLUG}.mdx`, `es/${SLUG}.mdx`, `pt/${SLUG}.mdx`].filter((file) => existsSync(join(casesDir, file)));
  const found = files.flatMap((file) => findDashes(readFileSync(join(casesDir, file), 'utf8')).map((dash) => `${file}: ${dash}`));
  assert.deepEqual(found, []);
});

// Checks on the built site.

test('the site is built', () => {
  assertBuilt(dist);
});

const pages = {};
for (const lang of LANGS) {
  const path = localizePath(CASE_PATH, lang);
  const html = read(path);
  const body = bodyOf(html);
  pages[lang] = {
    path,
    html,
    body,
    title: stripTags(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? ''),
    dek: stripTags(html.match(/<p\b[^>]*class="dek"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? ''),
    description: decode(html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? ''),
    headings: [...body.matchAll(/<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/g)].map(([, tag, inner]) => ({ tag, text: stripTags(inner) })),
    images: [...body.matchAll(/<img\b[^>]*>/g)].map(([tag]) => ({ file: stem(attribute(tag, 'src')), alt: attribute(tag, 'alt') })),
    captions: [...body.matchAll(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/g)].map(([, caption]) => stripTags(caption)),
  };
}

for (const lang of LANGS) {
  const page = pages[lang];
  const { path, html, body } = page;
  const skip = !html;

  test(`${path} is built`, () => {
    assertBuilt(builtFile(path));
  });

  // Scenario: Medium importa el caso y su canonical apunta al portfolio.
  test(`${path}: the canonical points to this page in the portfolio`, { skip }, () => {
    assert.deepEqual(checkCanonical(html, `${SITE}${path}`), []);
  });

  test(`${path}: the og:image is the deck's cover, and the hero is the same image`, { skip }, () => {
    const og = attribute(html.match(/<meta property="og:image"[^>]*>/)?.[0], 'content');
    assert.ok(og?.startsWith(`${SITE}/`), `og:image is ${og}`);
    assert.equal(stem(og), 'cover');
    assert.equal(page.images[0]?.file, 'cover', 'The first image of the body is not the cover');
    assert.match(body.match(/<img\b[^>]*>/)?.[0] ?? '', /\sloading="eager"/, 'The hero waits to load');
  });

  test(`${path}: the subtitle is the dek and the description is the meta description`, { skip }, () => {
    assert.ok(page.title && page.dek && page.description);
    assert.notEqual(page.dek, page.description);
    assert.equal(decode(html.match(/<meta property="og:description" content="([^"]*)"/)?.[1] ?? ''), page.description);
    if (lang === 'en') assert.deepEqual({ title: page.title, dek: page.dek, description: page.description }, CARD);
  });

  test(`${path}: the head lists the tags in the page's language`, { skip }, () => {
    const start = html.indexOf('class="container page-head');
    const head = html.slice(start, html.indexOf('class="container container-reading', start));
    const list = head.match(new RegExp(`<ul\\b[^>]*aria-label="${ui[lang].tagsLabel}"[^>]*>([\\s\\S]*?)</ul>`))?.[1] ?? '';
    const tags = [...list.matchAll(/<li\b[^>]*class="tag"[^>]*>([\s\S]*?)<\/li>/g)].map(([, tag]) => stripTags(tag));
    assert.deepEqual(tags, CASE_STUDY_TAGS.map((tag) => ui[lang].tags[tag]));
  });

  // Scenario: el pitch del juego y el punto de equilibrio se destacan en el color de acento.
  test(`${path}: the game's pitch and the break-even point are highlighted, in Overview and Business model`, { skip }, () => {
    const starts = [...body.matchAll(/<h2\b/g)].map((match) => match.index);
    const overview = body.slice(starts[0], starts[1]);
    const businessModel = body.slice(starts[4], starts[5]);
    const quotes = [...body.matchAll(/<blockquote\b[^>]*class="[^"]*\bpull-quote\b[^"]*"[^>]*>([\s\S]*?)<\/blockquote>/g)];
    assert.equal(quotes.length, 2, 'Expected two highlighted paragraphs');
    assert.ok(overview.includes(quotes[0][0]), 'The pitch is not in Overview');
    assert.ok(businessModel.includes(quotes[1][0]), 'The break-even point is not in Business model');
    assert.match(stripTags(quotes[1][1]), /11[.,]483/, 'The break-even point does not name its copies');
    assert.ok(!/elevator pitch/i.test(stripTags(body)), 'The body still says "elevator pitch"');
    if (lang === 'en') assert.match(stripTags(quotes[0][1]), /^You fell into hell, and the Devil wants to convince you there's no way out\./);
  });

  // Scenario: lo entregado se abre desde dos botones, el deck como primario y el modelo financiero como secundario.
  test(`${path}: Result opens the deck and the financial model from a primary and a quiet button`, { skip }, () => {
    const starts = [...body.matchAll(/<h2\b/g)].map((match) => match.index);
    const result = body.slice(starts[9], starts[10]);
    const buttons = [...result.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(([, attributes, inner]) => ({ attributes, inner }));
    assert.equal(buttons.length, 2, 'Expected two buttons in Result');
    const [deck, model] = buttons;
    assert.equal(decode(deck.attributes.match(/\shref="([^"]*)"/)?.[1] ?? ''), DECK);
    assert.equal(decode(model.attributes.match(/\shref="([^"]*)"/)?.[1] ?? ''), SHEET);
    assert.match(deck.attributes, /class="[^"]*\bbutton\b/);
    assert.doesNotMatch(deck.attributes, /\bbutton-quiet\b/, 'The deck is not the primary button');
    assert.match(model.attributes, /\bbutton-quiet\b/, 'The financial model is not the quiet button');
    for (const button of buttons) {
      assert.match(button.attributes, /\starget="_blank"/);
      assert.match(button.attributes, /\srel="noopener noreferrer"/);
      assert.ok(stripTags(button.inner).includes(ui[lang].opensInNewTab), 'No note that it opens in a new tab');
    }
  });

  // Scenario: el video va en Overview, después del pitch, sin cookies hasta reproducirlo y con carga diferida.
  test(`${path}: the video plays from youtube-nocookie, loads lazily and sits right after the pitch`, { skip }, () => {
    const frames = [...body.matchAll(/<iframe\b[^>]*>/g)].map(([tag]) => tag);
    assert.equal(frames.length, 1, 'Expected one video');
    const [frame] = frames;
    assert.equal(attribute(frame, 'src'), VIDEO);
    assert.equal(attribute(frame, 'loading'), 'lazy');
    assert.ok(attribute(frame, 'title')?.trim(), 'The video has no title for screen readers');
    const figure = body.match(/<figure\b[^>]*class="[^"]*\bvideo\b[^"]*"[^>]*>([\s\S]*?)<\/figure>/)?.[1] ?? '';
    assert.ok(figure.includes(frame) && /<figcaption\b/.test(figure), 'The video is not in a figure with a caption');
    // Overview: from its h2 to the next one. The video comes right after the pitch, the highlighted quote.
    const overview = body.slice(body.indexOf('<h2'), body.indexOf('<h2', body.indexOf('<h2') + 1));
    const before = overview.slice(0, overview.indexOf('<figure class="video'));
    assert.match(before, /<\/blockquote>\s*$/, 'The video is not right after the pitch');
    if (lang === 'en') {
      assert.equal(stripTags(figure.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/)?.[1] ?? ''), "Gameplay progress from the game's Unreal Engine prototype.");
    }
  });

  // Scenario: el video se ve limpio hasta que se reproduce, sin el título ni la foto del canal de YouTube.
  test(`${path}: the video waits behind our own poster and a play button, and loads YouTube only when pressed`, { skip }, () => {
    const figure = body.match(/<figure\b[^>]*class="[^"]*\bvideo\b[^"]*"[^>]*>([\s\S]*?)<\/figure>/)?.[1] ?? '';
    const frame = figure.match(/<div\b[^>]*class="[^"]*\bvideo-frame\b[^"]*"[^>]*>/)?.[0] ?? '';
    assert.equal(attribute(frame, 'data-video'), VIDEO, 'The frame does not name the video');
    const poster = figure.match(/<img\b[^>]*>/)?.[0];
    assert.ok(poster, 'No poster');
    assert.equal(stem(attribute(poster, 'src')), 'trailer-poster');
    assert.ok(attribute(poster, 'alt')?.trim(), 'The poster has no alt text');
    assert.doesNotMatch(poster, /ytimg|youtube/, 'The poster loads from YouTube');
    const button = figure.match(/<button\b[^>]*>([\s\S]*?)<\/button>/);
    assert.ok(button, 'No play button');
    assert.match(button[0], /class="[^"]*\bbutton\b/);
    assert.match(button[0], /\sdata-video-play\b/);
    assert.ok(stripTags(button[1]), 'The play button has no label');
    // Outside <noscript>, nothing loads from YouTube before the button is pressed.
    const live = figure.replace(/<noscript>[\s\S]*?<\/noscript>/g, '');
    assert.doesNotMatch(live, /<iframe\b/, 'The player loads before the button is pressed');
  });

  // The player the script adds carries no scope attribute: its size rule must reach a bare iframe, or it shows at 300 x 150.
  test(`${path}: the player fills the video frame once it loads`, { skip }, () => {
    // The page's own <style> blocks plus the stylesheets it links from the build.
    const inline = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map(([, css]) => css);
    const linked = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)]
      .map(([, href]) => join(dist, href))
      .filter((file) => existsSync(file))
      .map((file) => readFileSync(file, 'utf8'));
    const styles = [...inline, ...linked].join('\n');
    const rule = styles.match(/\.video-frame(?:\[[^\]]*\])?\s+iframe(?!\[)\s*\{([^}]*)\}/)?.[1];
    assert.ok(rule, 'No size rule for a bare iframe in the video frame');
    assert.match(rule, /position:\s*absolute/);
    assert.match(rule, /width:\s*100%/);
    assert.match(rule, /height:\s*100%/);
  });

  test(`${path}: the head's first spec names the course over the subject`, { skip }, () => {
    const expected = {
      en: ['UNAHUR course', 'Business Planning'],
      es: ['Materia UNAHUR', 'Planificación de negocios'],
      pt: ['Disciplina UNAHUR', 'Planejamento de Negócios'],
    }[lang];
    const head = html.slice(html.indexOf('class="container page-head'), html.indexOf('class="container container-reading'));
    const [, label, value] = head.match(/<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/) ?? [];
    assert.deepEqual([stripTags(label ?? ''), stripTags(value ?? '')], expected);
  });

  // Scenario: la columna derecha del encabezado muestra la ficha del juego, como en los análisis de Warcraft III.
  test(`${path}: the head's right column shows the game's fact sheet with its render`, { skip }, () => {
    assert.match(html, /class="[^"]*\bpage-head-with-aside\b/);
    const sheet = html.match(/<aside\b[^>]*class="[^"]*\bfact-sheet\b[^"]*"[^>]*>([\s\S]*?)<\/aside>/);
    assert.ok(sheet, 'No fact sheet');
    assert.equal(attribute(sheet[0], 'aria-label'), ui[lang].aboutGame);
    const image = sheet[1].match(/<img\b[^>]*>/)?.[0];
    assert.equal(stem(attribute(image, 'src')), 'character-render');
    assert.ok(attribute(image, 'alt')?.trim(), 'The render has no alt text');
    const facts = stripTags(sheet[1]);
    for (const value of ['El Diablo y Florentino', 'PC', 'Unreal Engine']) assert.ok(facts.includes(value), `Missing ${value}`);
    assert.ok(facts.includes(ui[lang].game.engine), `Missing the label ${ui[lang].game.engine}`);
    assert.ok(!facts.includes('Jonathan Puyol'), 'The fact sheet names the game creator');
  });

  // Scenario: los números del plan van en una tabla: cifras a la derecha, textos a la izquierda.
  test(`${path}: the plan's numbers are a table, with figures right-aligned and words left-aligned`, { skip }, () => {
    const tables = [...body.matchAll(/<table\b[\s\S]*?<\/table>/g)].map(([table]) => table);
    assert.equal(tables.length, 2, 'Expected two tables: pains and relievers, and the numbers');
    const table = tables.find((item) => /\bis-number\b/.test(item));
    assert.ok(table, 'No table of figures');
    assert.match(body, /<div\b[^>]*class="table-wrap"[^>]*role="region"[^>]*tabindex="0"/, 'The table does not scroll in a focusable region');
    assert.match(table, /<caption\b[^>]*>[\s\S]*\S[\s\S]*<\/caption>/, 'The table has no caption for screen readers');
    assert.equal([...table.matchAll(/<th\b[^>]*scope="col"/g)].length, 3, 'Expected three columns');
    const cells = [...table.matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/g)].map(([, attributes, cell]) => ({
      text: stripTags(cell),
      right: /\bis-number\b/.test(attributes),
    }));
    const figure = (text) => /^(USD )?\d[\d.,]*$/.test(text);
    assert.ok(cells.filter((cell) => figure(cell.text)).length >= 6, 'Expected a figure in each row');
    assert.deepEqual(cells.filter((cell) => figure(cell.text) !== cell.right).map((cell) => cell.text), []);
    if (lang === 'en') assert.ok(cells.some((cell) => cell.text === 'USD 124,909'), 'The total investment is missing');
  });

  // Scenario: cada dolor del jugador queda frente a su aliviador, en una tabla, en Propuesta de valor.
  test(`${path}: each player pain faces its pain reliever in a table`, { skip }, () => {
    // Value proposition is the fourth section: from its h2 to the next one.
    const starts = [...body.matchAll(/<h2\b/g)].map((match) => match.index);
    const section = body.slice(starts[3], starts[4]);
    const tables = [...body.matchAll(/<table\b[\s\S]*?<\/table>/g)].map(([table]) => table);
    const pairs = tables.find((item) => !/\bis-number\b/.test(item));
    assert.ok(pairs, 'No table of pains and relievers');
    assert.ok(section.includes(pairs), 'The table of pains and relievers is not in Value proposition');
    assert.equal([...pairs.matchAll(/<th\b[^>]*scope="col"/g)].length, 2, 'Expected two columns: pain and reliever');
    assert.equal([...pairs.matchAll(/<th\b[^>]*scope="row"/g)].length, 3, 'Expected three pains');
    assert.ok(!/\bis-muted\b/.test(pairs), 'The relievers are muted');
    if (lang === 'en') assert.match(stripTags(pairs), /Luck-based fights\s*Enemy attack patterns that are fully readable and deterministic/);
  });

  test(`${path}: the numbers link to the cost spreadsheet`, { skip }, () => {
    const links = [...body.matchAll(/<a\b[^>]*href="([^"]*)"/g)].map(([, href]) => decode(href));
    assert.ok(links.includes(SHEET), 'No link to the spreadsheet');
    assert.ok(!links.some((href) => href.includes('ouid=')), 'A link carries the owner account ID');
  });

  // Scenario: la estructura entra en el import de Medium (la tabla aparte: Medium no importa tablas).
  test(`${path}: the body has h2 sections and every image in a figure with a caption`, { skip }, () => {
    assert.deepEqual([...new Set(page.headings.map((heading) => heading.tag))].filter((tag) => !['h2', 'h3'].includes(tag)), []);
    const figures = [...body.matchAll(/<figure\b[\s\S]*?<\/figure>/g)].map(([figure]) => figure);
    const images = figures.filter((figure) => /<img\b/.test(figure));
    assert.equal(images.length, page.images.length, 'An image is outside a figure');
    // The hero opens the case with no caption: the credits line names where it comes from. Every other figure has one.
    const [hero, ...rest] = figures;
    assert.ok(!/<figcaption\b/.test(hero), 'The hero has a caption');
    assert.ok(rest.every((figure) => /<figcaption\b[^>]*>[\s\S]*\S[\s\S]*<\/figcaption>/.test(figure)), 'A figure has no caption');
  });

  test(`${path}: section titles are in sentence case`, { skip }, () => {
    // Words that keep their capitals inside a title: the pronoun I and the acronyms.
    const keep = new Set(['I', 'AI', 'IA']);
    const wrong = page.headings
      .map((heading) => heading.text)
      .filter((text) => {
        const [first, ...rest] = text.split(/\s+/);
        return first[0] !== first[0].toUpperCase() || rest.some((word) => word[0] !== word[0].toLowerCase() && !keep.has(word));
      });
    assert.deepEqual(wrong, []);
    if (lang === 'en') assert.deepEqual(page.headings.map((heading) => heading.text), SECTIONS);
  });

  test(`${path}: money is in US dollars and no placeholder is left`, { skip }, () => {
    // Copy only: scripts and styles are not text a reader sees.
    const text = stripTags(body.replace(/<script\b[\s\S]*?<\/script>/g, '').replace(/<style\b[\s\S]*?<\/style>/g, ''));
    assert.ok(/USD \d/.test(text), 'No amounts in USD');
    assert.deepEqual(text.match(/\$|€|R\$|\bARS\b|\bBRL\b|\bpesos?\b|\breais\b/g) ?? [], []);
    assert.deepEqual(text.match(/\[[^\]]*\]/g) ?? [], [], 'A placeholder in brackets is left in the text');
  });

  test(`${path}: the credits name how the persona portrait, the artwork and the icons were made`, { skip }, () => {
    const credits = stripTags(html.match(/<p\b[^>]*class="article-credits"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? '');
    assert.match(credits, /Gemini Pro/);
    assert.match(credits, /game-icons\.net/);
    assert.match(credits, /CC BY 3\.0/);
  });
}

// Scenario: cada traducción mantiene las secciones, las imágenes y el video del original, con sus textos traducidos.
for (const lang of ['es', 'pt']) {
  const page = pages[lang];
  const original = pages.en;
  const skip = !page.html || !original.html;

  test(`${page.path} keeps the original's sections, images and captions, translated`, { skip }, () => {
    assert.deepEqual(page.headings.map((heading) => heading.tag), original.headings.map((heading) => heading.tag), 'Different sections');
    assert.deepEqual(page.images.map((image) => image.file), original.images.map((image) => image.file), 'Different images or order');
    assert.equal(page.captions.length, original.captions.length, 'Different number of captions');
    const pairs = [
      ['title', page.title, original.title],
      ['dek', page.dek, original.dek],
      ['description', page.description, original.description],
      ...page.headings.map((heading, index) => [`section ${index + 1}`, heading.text, original.headings[index]?.text]),
      ...page.images.map((image, index) => [`alt text of image ${index + 1}`, image.alt, original.images[index]?.alt]),
      ...page.captions.map((caption, index) => [`caption ${index + 1}`, caption, original.captions[index]]),
    ];
    assert.deepEqual(pairs.filter(([, text, english]) => text === english).map(([field]) => field), [], 'Untranslated');
    assert.deepEqual(pairs.filter(([, text]) => !text).map(([field]) => field), [], 'Empty');
  });
}

// The /case-studies/ list in each language: its title, its intro and one row per case, newest first.
for (const lang of LANGS) {
  const listPath = localizePath('/case-studies/', lang);
  const html = read(listPath);
  const skip = !html;
  const t = ui[lang];

  test(`${listPath} is built`, () => {
    assertBuilt(builtFile(listPath));
  });

  test(`${listPath} shows its title, its intro and a row for the case, with the hero as thumbnail`, { skip }, () => {
    assert.equal(stripTags(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? ''), t.caseStudiesTitle);
    assert.equal(stripTags(html.match(/<p\b[^>]*class="dek"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? ''), t.caseStudiesIntro);
    const rows = [...html.matchAll(/<li\b[^>]*class="row[^"]*"[^>]*>([\s\S]*?)<\/li>/g)].map(([, row]) => row);
    const row = rows.find((item) => attribute(item.match(/<a\b[^>]*>/)?.[0], 'href') === localizePath(CASE_PATH, lang));
    assert.ok(row, `No row links to ${localizePath(CASE_PATH, lang)}`);
    const page = pages[lang];
    assert.equal(stripTags(row.match(/<h2\b[^>]*class="row-title"[^>]*>([\s\S]*?)<\/h2>/)?.[1] ?? ''), page.title);
    assert.equal(stripTags(row.match(/<p\b[^>]*class="row-text"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? ''), page.description);
    assert.equal(stripTags(row.match(/<p\b[^>]*class="row-meta"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? ''), '2026');
    const image = row.match(/<img\b[^>]*>/)?.[0];
    assert.equal(stem(attribute(image, 'src')), page.images[0]?.file);
    assert.equal(attribute(image, 'alt'), page.images[0]?.alt);
  });
}

// Scenario: el menú lleva a Case studies desde cualquier página, como primer ítem, marcado en su sección.
function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.name.endsWith('.html') ? [path] : [];
  });
}

const built = existsSync(dist) ? htmlFiles(dist).filter((file) => !isGameCopy(relative(dist, file))) : [];

for (const file of built) {
  const html = readFileSync(file, 'utf8');
  if (isRedirect(html)) continue;
  const path = pathForFile(relative(dist, file));
  const lang = langFromPath(path);
  const section = localizePath('/case-studies/', lang);
  const menu = headerOf(html).match(/<ul\b[^>]*class="site-nav"[^>]*>([\s\S]*?)<\/ul>/)?.[1] ?? '';
  const links = [...menu.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(([, attributes, label]) => ({ attributes, label: stripTags(label) }));

  test(`${path}: the menu opens with ${ui[lang].navCaseStudies}, marked where it applies`, () => {
    const matching = links.filter((link) => link.label === ui[lang].navCaseStudies);
    assert.equal(matching.length, 1, `Exactly one ${ui[lang].navCaseStudies} link in the menu`);
    assert.equal(links[0]?.label, ui[lang].navCaseStudies, 'It is not the first item of the menu');
    const { attributes } = matching[0];
    assert.match(attributes, new RegExp(`\\shref="${section}"`));
    assert.match(attributes, /\sdata-umami-event="nav-case-studies"/);
    const expected = path === section ? 'page' : path.startsWith(section) ? 'true' : undefined;
    assert.equal(attributes.match(/\saria-current="([^"]*)"/)?.[1], expected);
  });
}
