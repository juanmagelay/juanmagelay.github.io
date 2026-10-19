// The site in English, Spanish (Argentina) and Portuguese (Brazil), with a language switch. Issue #11.
// The checks on dist/ need npm run build first. Post texts are approved by the PO; these checks cover the rest.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../astro.config.mjs';
import { assertBuilt, isRedirect, pathForFile } from './site-checks.mjs';
import { LANGS, languages, langFromPath, localizePath, unlocalizePath } from '../src/i18n.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');

// Each rule must fail on an example that breaks it.

test('the language comes from the first part of the path, and English has no prefix', () => {
  assert.equal(langFromPath('/writing/x/'), 'en');
  assert.equal(langFromPath('/es/writing/x/'), 'es');
  assert.equal(langFromPath('/pt/'), 'pt');
  assert.equal(langFromPath('/esports/'), 'en');
  assert.equal(langFromPath('/'), 'en');
});

test('a path moves to another language and keeps the rest', () => {
  assert.equal(localizePath('/writing/x/', 'es'), '/es/writing/x/');
  assert.equal(localizePath('/es/writing/x/', 'pt'), '/pt/writing/x/');
  assert.equal(localizePath('/pt/writing/x/', 'en'), '/writing/x/');
  assert.equal(localizePath('/', 'es'), '/es/');
  assert.equal(localizePath('/es/', 'en'), '/');
  assert.equal(unlocalizePath('/pt/404/'), '/404/');
});

// Checks on the built site.
test('the site is built', () => {
  assertBuilt(dist);
});

function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.name.endsWith('.html') ? [path] : [];
  });
}

const decode = (text) =>
  text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
const stripTags = (fragment) => decode(fragment.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
const attribute = (tag, name) => {
  const value = tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
  return value === undefined ? undefined : decode(value);
};
const ids = (html) => new Set([...html.matchAll(/\sid="([^"]*)"/g)].map(([, id]) => decode(id)));
const anchors = (html) =>
  [...html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)].map(([tag, inner]) => ({
    href: attribute(tag, 'href') ?? '',
    hreflang: attribute(tag, 'hreflang'),
    label: stripTags(inner),
    tag,
  }));
const headerOf = (html) => html.slice(html.indexOf('<header'), html.indexOf('</header>'));
const headOf = (html) => html.slice(0, html.indexOf('</head>'));

// The built file for a site path: /404/ is 404.html, a path ending in / is its index.html.
function builtFile(sitePath) {
  if (sitePath === '/404/') return join(dist, '404.html');
  return join(dist, decodeURI(sitePath), sitePath.endsWith('/') ? 'index.html' : '');
}

const built = existsSync(dist) ? htmlFiles(dist) : [];
const pages = built
  .map((file) => ({ path: pathForFile(relative(dist, file)), html: readFileSync(file, 'utf8') }))
  .filter((page) => !isRedirect(page.html));
const byPath = new Map(pages.map((page) => [page.path, page.html]));

// Scenario: cada página existe en los tres idiomas.
test('every page exists in English, Spanish and Portuguese', () => {
  assert.ok(pages.length > 0, 'No pages in the build');
  const missing = pages.flatMap((page) =>
    LANGS.map((lang) => localizePath(page.path, lang)).filter((path) => !byPath.has(path))
  );
  assert.deepEqual([...new Set(missing)], []);
});

const SWITCH_LABEL = { en: 'Language', es: 'Idioma', pt: 'Idioma' };

// The interface in each language: skip link, menu, CV button, copy button and contact title.
const CHROME = {
  en: { skip: 'Skip to content', nav: 'Main', cv: 'Download CV', copy: 'Copy email', contact: 'Contact' },
  es: { skip: 'Saltar al contenido', nav: 'Principal', cv: 'Descargar CV', copy: 'Copiar email', contact: 'Contacto' },
  pt: { skip: 'Pular para o conteúdo', nav: 'Principal', cv: 'Baixar CV', copy: 'Copiar e-mail', contact: 'Contato' },
};

for (const { path, html } of pages) {
  const lang = langFromPath(path);
  const header = headerOf(html);
  const noindex = /<meta name="robots" content="noindex"/.test(html);

  test(`${path}: the page declares its language`, () => {
    assert.equal(html.match(/<html\b[^>]*\slang="([^"]*)"/)?.[1], languages[lang].htmlLang);
    assert.equal(headOf(html).match(/<meta property="og:locale" content="([^"]*)"/)?.[1], languages[lang].ogLocale);
  });

  test(`${path}: the interface is in the page's language`, () => {
    const chrome = CHROME[lang];
    assert.equal(stripTags(html.match(/<a\b[^>]*class="skip-link"[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? ''), chrome.skip);
    assert.match(header, new RegExp(`<nav\\b[^>]*aria-label="${chrome.nav}"`));
    assert.equal(stripTags(header.match(/<a\b[^>]*class="[^"]*\bsite-cv\b[^"]*"[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? ''), chrome.cv);
    assert.equal(stripTags(html.match(/<button\b[^>]*data-copy-email[^>]*>([\s\S]*?)<\/button>/)?.[1] ?? ''), chrome.copy);
    assert.equal(stripTags(html.match(/<h2\b[^>]*id="contact-title"[^>]*>([\s\S]*?)<\/h2>/)?.[1] ?? ''), chrome.contact);
  });

  // Scenario: el switch de idioma está arriba a la derecha y lleva a la misma página en cada idioma.
  test(`${path}: the language switch is the last item of the header and links to this page in each language`, () => {
    const start = header.lastIndexOf('<nav');
    const nav = header.slice(start);
    assert.match(nav, new RegExp(`^<nav\\b[^>]*aria-label="${SWITCH_LABEL[lang]}"`), 'The last block of the header is not the language switch');
    assert.match(nav, /<\/nav>\s*<\/div>\s*$/, 'Something comes after the language switch in the header');
    const links = anchors(nav).map((link) => ({
      code: link.label.split(' ')[0],
      href: link.href,
      hreflang: link.hreflang,
      lang: attribute(link.tag, 'lang'),
      current: attribute(link.tag, 'aria-current'),
      event: [attribute(link.tag, 'data-umami-event'), attribute(link.tag, 'data-umami-event-language')],
    }));
    assert.deepEqual(
      links,
      LANGS.map((other) => ({
        code: other.toUpperCase(),
        href: localizePath(path, other),
        hreflang: other,
        lang: languages[other].htmlLang,
        current: other === lang ? 'true' : undefined,
        event: ['language-switch', other],
      }))
    );
  });

  test(`${path}: each language in the switch is named in that language for screen readers`, () => {
    const nav = header.slice(header.lastIndexOf('<nav'));
    assert.deepEqual(
      anchors(nav).map((link) => link.label),
      LANGS.map((other) => `${other.toUpperCase()} ${languages[other].name}`)
    );
  });

  // Search engines show each reader the page in their language. 404 pages are not listed at all.
  test(`${path}: search engines get the page in each language`, () => {
    const alternates = [...headOf(html).matchAll(/<link rel="alternate" hreflang="([^"]*)" href="([^"]*)"/g)].map(
      ([, hreflang, href]) => [hreflang, href]
    );
    const expected = noindex
      ? []
      : [
          ...LANGS.map((other) => [other, new URL(localizePath(path, other), config.site).href]),
          ['x-default', new URL(localizePath(path, 'en'), config.site).href],
        ];
    assert.deepEqual(alternates, expected);
  });

  // Scenario: los links internos funcionan y no cambian de idioma sin avisar.
  test(`${path}: every internal link goes to a built page, and to an existing section`, () => {
    const broken = anchors(html)
      .filter((link) => link.href.startsWith('/') && !link.href.startsWith('//'))
      .flatMap((link) => {
        const [target, hash] = link.href.split('#');
        const file = builtFile(target);
        if (!existsSync(file)) return [`${link.href}: no page`];
        if (hash && !ids(readFileSync(file, 'utf8')).has(decodeURIComponent(hash))) return [`${link.href}: no section`];
        return [];
      });
    const missingTargets = anchors(html)
      .filter((link) => link.href.startsWith('#') && link.href.length > 1)
      .filter((link) => !ids(html).has(decodeURIComponent(link.href.slice(1))))
      .map((link) => `${link.href}: no section on this page`);
    assert.deepEqual([...broken, ...missingTargets], []);
  });

  test(`${path}: links to pages stay in the page's language, unless they say they don't`, () => {
    const leaks = anchors(html)
      .filter((link) => link.href.startsWith('/') && !link.href.startsWith('//') && !link.href.startsWith('/cv/'))
      .filter((link) => link.hreflang === undefined && langFromPath(link.href) !== lang)
      .map((link) => `${link.label}: ${link.href}`);
    assert.deepEqual(leaks, []);
  });
}

// Scenario: la 404 aparece en el idioma de la dirección.
test('GitHub Pages serves the English 404, which sends missing URLs under /es/ and /pt/ to their own 404', () => {
  const page = join(dist, '404.html');
  assertBuilt(page);
  const head = headOf(readFileSync(page, 'utf8'));
  assert.match(head, /const translated = \["es","pt"\];/);
  assert.match(head, /location\.replace\(`\/\$\{lang\}\/404\/`\)/);
});

for (const lang of ['es', 'pt']) {
  test(`/${lang}/404/ is in its language, never redirects and is not listed by search engines`, () => {
    const html = byPath.get(`/${lang}/404/`) ?? '';
    assert.ok(html, `No /${lang}/404/ page`);
    assert.doesNotMatch(html, /location\.replace/);
    assert.match(html, /<meta name="robots" content="noindex"/);
  });
}

// Until the home page exists (#8), each language's root opens the first post in that language.
for (const lang of LANGS) {
  const from = localizePath('/', lang);
  const to = localizePath('/writing/warcraft-iii-ux-analysis/', lang);
  test(`${from} redirects to ${to}`, () => {
    assert.equal(config.redirects?.[from], to);
    const html = readFileSync(join(dist, from, 'index.html'), 'utf8');
    assert.ok(isRedirect(html) && html.includes(`url=${to}"`), `${from} does not redirect to ${to}`);
  });
}

// Scenario: los posts están traducidos completos.
const writingDir = join(root, 'src/content/writing');
const originals = readdirSync(writingDir).filter((name) => /\.mdx?$/.test(name));

test('every post has a Spanish and a Portuguese version', () => {
  const missing = originals.flatMap((name) =>
    ['es', 'pt'].filter((lang) => !existsSync(join(writingDir, lang, name))).map((lang) => `src/content/writing/${lang}/${name}`)
  );
  assert.deepEqual(missing, []);
});

// What a post page shows, to compare a translation with its original.
function postParts(html) {
  const start = html.indexOf('class="prose"');
  const body = html.slice(start, html.indexOf('</article>', start));
  const spec = (label) => stripTags(html.match(new RegExp(`<dt\\b[^>]*>${label}</dt>\\s*<dd\\b[^>]*>([\\s\\S]*?)</dd>`))?.[1] ?? '');
  return {
    title: stripTags(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? ''),
    dek: stripTags(html.match(/<p\b[^>]*class="dek"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? ''),
    spec,
    published: html.match(/<time\b[^>]*datetime="([^"]*)"[^>]*>([\s\S]*?)<\/time>/)?.slice(1) ?? [],
    coverAlt: attribute(html.match(/<img\b[^>]*class="[^"]*\bfact-sheet-image\b[^"]*"[^>]*>/)?.[0] ?? '', 'alt'),
    credits: stripTags(html.match(/<p\b[^>]*class="[^"]*\barticle-credits\b[^"]*"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? ''),
    headings: [...body.matchAll(/<(h[23])\b/g)].map(([, tag]) => tag),
    images: [...body.matchAll(/<img\b[^>]*>/g)].map(([tag]) => ({
      file: (attribute(tag, 'src') ?? '').split('/').pop().split('.')[0],
      alt: attribute(tag, 'alt'),
    })),
    captions: [...body.matchAll(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/g)].map(([, caption]) => stripTags(caption)),
    externalLinks: anchors(body)
      .map((link) => link.href)
      .filter((href) => href.startsWith('http'))
      .sort(),
    keys: [...body.matchAll(/<kbd>([\s\S]*?)<\/kbd>/g)].map(([, key]) => key),
  };
}

const SPEC_LABELS = {
  en: { context: 'Context', genre: 'Genre', platform: 'Platform', published: 'Published' },
  es: { context: 'Contexto', genre: 'Género', platform: 'Plataforma', published: 'Publicado' },
  pt: { context: 'Contexto', genre: 'Gênero', platform: 'Plataforma', published: 'Publicado' },
};

// The first post's date as each language writes it.
const FIRST_POST_DATE = { en: 'October 15, 2026', es: '15 de octubre de 2026', pt: '15 de outubro de 2026' };

for (const name of originals) {
  const slug = name.replace(/\.mdx?$/, '');
  const originalPath = `/writing/${slug}/`;
  const original = byPath.has(originalPath) ? postParts(byPath.get(originalPath)) : undefined;

  for (const lang of ['es', 'pt']) {
    const path = localizePath(originalPath, lang);
    const html = byPath.get(path);
    const skip = !html || !original;
    const translation = html ? postParts(html) : undefined;

    test(`${path} keeps the original's sections, images, keys and sources`, { skip }, () => {
      assert.deepEqual(translation.headings, original.headings, 'Different headings');
      assert.deepEqual(
        translation.images.map((image) => image.file),
        original.images.map((image) => image.file),
        'Different images or order'
      );
      assert.equal(translation.captions.length, original.captions.length, 'Different number of captions');
      assert.deepEqual(translation.keys, original.keys, 'Different keyboard keys');
      assert.deepEqual(translation.externalLinks, original.externalLinks, 'Different external links');
    });

    test(`${path} translates every text of the original`, { skip }, () => {
      const labels = SPEC_LABELS[lang];
      const english = SPEC_LABELS.en;
      const pairs = [
        ['title', translation.title, original.title],
        ['dek', translation.dek, original.dek],
        ['context', translation.spec(labels.context), original.spec(english.context)],
        ['genre', translation.spec(labels.genre), original.spec(english.genre)],
        ['platform', translation.spec(labels.platform), original.spec(english.platform)],
        ['cover alt text', translation.coverAlt, original.coverAlt],
        ['credits', translation.credits, original.credits],
        ...translation.images.map((image, index) => [`alt text of image ${index + 1}`, image.alt, original.images[index]?.alt]),
        ...translation.captions.map((caption, index) => [`caption ${index + 1}`, caption, original.captions[index]]),
      ];
      const untranslated = pairs.filter(([, text, english]) => text && text === english).map(([field]) => field);
      const empty = pairs.filter(([, text, english]) => english && !text).map(([field]) => field);
      assert.deepEqual({ untranslated, empty }, { untranslated: [], empty: [] });
    });

    test(`${path} shows the original's date, written in its language`, { skip }, () => {
      assert.equal(translation.published[0], original.published[0]);
      if (slug === 'warcraft-iii-ux-analysis') {
        assert.equal(stripTags(translation.published[1]), FIRST_POST_DATE[lang]);
        assert.equal(stripTags(original.published[1]), FIRST_POST_DATE.en);
      }
    });
  }
}

// Scenario: las traducciones respetan las reglas de estilo del sitio. Dashes are checked on every page by dist.test.mjs.
const BUZZWORDS = {
  es: ['apasionad', 'potenciar', 'sin fricciones', 'empoderar', 'innovador', 'de vanguardia', 'encantador'],
  pt: ['apaixonad', 'alavancar', 'sem atrito', 'empoderar', 'inovador', 'de ponta', 'encantador'],
};

for (const { path, html } of pages) {
  const lang = langFromPath(path);
  if (!BUZZWORDS[lang]) continue;
  test(`${path} uses none of the banned buzzwords in ${languages[lang].name}`, () => {
    const text = stripTags(html.slice(html.indexOf('<body'))).toLowerCase();
    assert.deepEqual(
      BUZZWORDS[lang].filter((word) => new RegExp(`(^|[^\\p{L}])${word}`, 'u').test(text)),
      []
    );
  });
}
