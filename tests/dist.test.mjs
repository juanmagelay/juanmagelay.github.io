// Runs the site rules on every page of the build. Run npm run build first. Issue #1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../astro.config.mjs';
import { site } from '../src/site.config.mjs';
import {
  assertBuilt,
  pathForFile,
  isRedirect,
  findImagesWithoutAlt,
  findDashes,
  checkCanonical,
  findBrokenCvLinks,
  findLinks,
  checkAnalytics,
} from './site-checks.mjs';
import { langFromPath, ui } from '../src/i18n.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));

async function htmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return htmlFiles(path);
      return entry.name.endsWith('.html') ? [path] : [];
    })
  );
  return files.flat();
}

test('the site is built', () => {
  assertBuilt(dist);
});

const pages = existsSync(dist) ? await htmlFiles(dist) : [];
const builtFileExists = (sitePath) => existsSync(join(dist, sitePath));

// Issue #11: the Spanish site links the Spanish CV. There is no Portuguese CV, so the Portuguese site links the English one.
const ENGLISH_CV = { href: site.cvPath, download: 'CV Juan Manuel Gelay · Product Design Manager.pdf', language: 'en' };
const SPANISH_CV = { href: site.cvSpanishPath, download: 'CV Juan Manuel Gelay · Product Design Manager (ES).pdf', language: 'es' };
const CV = { en: ENGLISH_CV, es: SPANISH_CV, pt: ENGLISH_CV };

// The contact section in each language: the lead, the bio line by line and the note issue #12 removed.
const CONTACT = {
  en: {
    lead: 'Email is the fastest way to reach me.',
    bio: ['Juan Manuel Gelay', 'Product Design Manager at Auronix.', 'Based in Buenos Aires, Argentina (UTC-3).', 'Languages: Spanish (native), English, Portuguese.'],
    removedNote: 'Case studies from my product work are on the way.',
  },
  es: {
    lead: 'El email es la forma más rápida de contactarme.',
    bio: ['Juan Manuel Gelay', 'Product Design Manager en Auronix.', 'Radicado en Buenos Aires, Argentina (UTC-3).', 'Idiomas: español (nativo), inglés, portugués.'],
    removedNote: 'Los casos de estudio de mi trabajo en producto están en camino.',
  },
  pt: {
    lead: 'O e-mail é o jeito mais rápido de falar comigo.',
    bio: ['Juan Manuel Gelay', 'Product Design Manager na Auronix.', 'Baseado em Buenos Aires, Argentina (UTC-3).', 'Idiomas: espanhol (nativo), inglês, português.'],
    removedNote: 'Os estudos de caso do meu trabalho com produto estão a caminho.',
  },
};

// The path of the copy icon, as Google publishes it in Material Symbols. Issue #12.
const COPY_ICON = readFileSync(new URL('../src/assets/icons/content_copy.svg', import.meta.url), 'utf8').match(/\sd="([^"]+)"/)[1];

const decode = (text) =>
  text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

const stripTags = (fragment) => decode(fragment.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();

// Issue #7. This URL is already shared: renaming the file would break those links.
test('the English CV keeps its published URL', () => {
  assert.equal(site.cvPath, '/cv/Juan Manuel Gelay - UX & Product Design Manager (English).pdf');
  assert.ok(builtFileExists(site.cvPath), `No CV in the build at ${site.cvPath}`);
});

for (const file of pages) {
  const name = relative(dist, file);
  const path = pathForFile(name);
  const lang = langFromPath(path);
  const html = await readFile(file, 'utf8');

  if (isRedirect(html)) {
    test(`${name}: redirect canonical points to its target`, () => {
      const target = config.redirects?.[path];
      assert.ok(target, `${path} is a redirect page but astro.config.mjs has no redirect for it`);
      assert.deepEqual(checkCanonical(html, new URL(target, config.site).href), []);
    });
    continue;
  }

  test(`${name}: every image has alt text`, () => {
    assert.deepEqual(findImagesWithoutAlt(html), []);
  });

  test(`${name}: no em or en dashes in the copy`, () => {
    assert.deepEqual(findDashes(html), []);
  });

  test(`${name}: canonical points to this page`, () => {
    assert.deepEqual(checkCanonical(html, new URL(path, config.site).href), []);
  });

  test(`${name}: CV links point to a file in the build`, () => {
    assert.deepEqual(findBrokenCvLinks(html, builtFileExists), []);
  });

  // Issue #2
  test(`${name}: analytics match the website ID and only count the live domain`, () => {
    const domain = new URL(config.site).hostname;
    assert.deepEqual(checkAnalytics(html, { websiteId: site.umamiWebsiteId, domain }), []);
  });

  test(`${name}: contact actions send their analytics events`, () => {
    const links = findLinks(html);
    const tracked = (href) => links.filter((link) => link.href === href).map((link) => [link.event, link.location]);
    assert.deepEqual(tracked(`mailto:${site.email}`), [['email-click', undefined]]);
    // Issue #7: each CV download also sends its language.
    const trackedCv = (href) => links.filter((link) => link.href === href).map((link) => [link.event, link.location, link.language]);
    const cv = CV[lang];
    assert.deepEqual(trackedCv(cv.href), [['cv-download', 'header', cv.language], ['cv-download', 'footer', cv.language]]);
    assert.deepEqual(tracked(site.linkedin), [['linkedin', undefined]]);
    // Only the menu link: articles may also link to #contact.
    const header = html.slice(html.indexOf('<header'), html.indexOf('</header>'));
    const menuContact = findLinks(header).filter((link) => link.href === '#contact');
    assert.deepEqual(menuContact.map((link) => [link.event, link.location]), [['nav-contact', undefined]]);
  });

  // Issue #7. Issue #11: in the CV's language, with its file name and hreflang.
  test(`${name}: the CV downloads in the page's language, with its file name`, () => {
    const cv = CV[lang];
    const downloads = findLinks(html)
      .filter((link) => link.href === cv.href)
      .map((link) => [link.download, link.hreflang]);
    assert.deepEqual(downloads, [
      [cv.download, cv.language],
      [cv.download, cv.language],
    ]);
  });

  // Issue #6 left the Spanish CV for the Spanish version of the site. Issue #11: only Spanish pages link it.
  test(`${name}: only Spanish pages link the Spanish CV`, () => {
    const other = lang === 'es' ? site.cvPath : site.cvSpanishPath;
    assert.deepEqual(findLinks(html).filter((link) => link.href === other), []);
  });

  // Issue #12. Scenario: el footer separa el contacto de la presentación.
  test(`${name}: the footer shows how to reach me first, then who I am`, () => {
    const footer = html.slice(html.indexOf('<footer'), html.indexOf('</footer>'));
    const order = [
      ['how to reach me', /class="[^"]*\bcontact-reach\b/],
      ['title', /id="contact-title"/],
      ['lead', /class="[^"]*\bcontact-lead\b/],
      ['email and copy button', /class="[^"]*\bcopy-email\b/],
      ['who I am', /class="[^"]*\bcontact-about\b/],
      ['bio', /class="[^"]*\bcontact-who\b/],
      ['CV', /data-umami-event="cv-download"/],
      ['LinkedIn', /data-umami-event="linkedin"/],
    ];
    let previous = -1;
    for (const [part, pattern] of order) {
      const at = footer.search(pattern);
      assert.ok(at > previous, `The footer's ${part} is missing or out of order`);
      previous = at;
    }
    assert.equal(stripTags(footer.match(/<p\b[^>]*class="[^"]*\bcontact-lead\b[^"]*"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? ''), CONTACT[lang].lead);
    assert.ok(!stripTags(footer).includes(CONTACT[lang].removedNote), 'The case studies note is still in the footer');
  });

  // Issue #12. Scenario: la presentación se lee en cuatro líneas.
  test(`${name}: the bio reads in four lines, with the name in the accent, the role in bold and a link to Auronix`, () => {
    const who = html.match(/<p\b[^>]*class="[^"]*\bcontact-who\b[^"]*"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? '';
    assert.deepEqual(who.split(/<br\b[^>]*>/).map(stripTags), CONTACT[lang].bio);
    assert.equal(stripTags(who.match(/<span\b[^>]*class="contact-name"[^>]*>([\s\S]*?)<\/span>/)?.[1] ?? ''), site.name);
    assert.equal(stripTags(who.match(/<strong\b[^>]*>([\s\S]*?)<\/strong>/)?.[1] ?? ''), 'Product Design Manager');
    const links = [...who.matchAll(/<a\b[^>]*\bhref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map(([, href, inner]) => [stripTags(inner), href]);
    assert.deepEqual(links, [['Auronix', 'https://www.auronix.com/']]);
  });

  // Issue #12. Scenario: el botón solo ícono sigue siendo usable.
  test(`${name}: the copy button shows the Material Symbols icon before its text`, () => {
    const button = html.match(/<button\b[^>]*data-copy-email[^>]*>([\s\S]*?)<\/button>/)?.[1] ?? '';
    const icon = button.search(/<svg\b/);
    const label = button.search(/<span\b[^>]*class="copy-email-label"/);
    assert.ok(icon >= 0 && button.includes(COPY_ICON), 'The copy button has no content_copy icon');
    assert.ok(label > icon, 'The icon is not before the text');
    assert.equal(stripTags(button.slice(label)), ui[lang].copyEmail);
  });

  // Issue #12: icons are decorative. The button or link around one is named by its text.
  test(`${name}: every icon is hidden from screen readers and sits in a control with text`, () => {
    for (const [tag] of html.matchAll(/<svg\b[^>]*>/g)) {
      assert.match(tag, /\baria-hidden="true"/, `Icon not hidden from screen readers: ${tag}`);
    }
    for (const [, , inner] of html.matchAll(/<(button|a)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
      if (inner.includes('<svg')) assert.notEqual(stripTags(inner), '', 'A control with an icon has no text');
    }
  });

  test(`${name}: copying the email sends email-copy`, () => {
    // The minifier may quote the event name with ", ' or a backtick.
    assert.match(html, /track\(\s*["'`]email-copy["'`]\s*\)/);
  });
}
