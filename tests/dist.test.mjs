// Runs the site rules on every page of the build. Run npm run build first. Issue #1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
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

// Issue #7. This URL is already shared: renaming the file would break those links.
test('the English CV keeps its published URL', () => {
  assert.equal(site.cvPath, '/cv/Juan Manuel Gelay - UX & Product Design Manager (English).pdf');
  assert.ok(builtFileExists(site.cvPath), `No CV in the build at ${site.cvPath}`);
});

for (const file of pages) {
  const name = relative(dist, file);
  const path = pathForFile(name);
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
    assert.deepEqual(trackedCv(site.cvPath), [['cv-download', 'header', 'en'], ['cv-download', 'footer', 'en']]);
    assert.deepEqual(trackedCv(site.cvSpanishPath), [['cv-download', 'footer', 'es']]);
    assert.deepEqual(tracked(site.linkedin), [['linkedin', undefined]]);
    // Only the menu link: articles may also link to #contact.
    const header = html.slice(html.indexOf('<header'), html.indexOf('</header>'));
    const menuContact = findLinks(header).filter((link) => link.href === '#contact');
    assert.deepEqual(menuContact.map((link) => [link.event, link.location]), [['nav-contact', undefined]]);
  });

  // Issue #7
  test(`${name}: each CV downloads with its new file name`, () => {
    const links = findLinks(html);
    const downloads = (href) => links.filter((link) => link.href === href).map((link) => link.download);
    const english = 'CV Juan Manuel Gelay · Product Design Manager.pdf';
    assert.deepEqual(downloads(site.cvPath), [english, english]);
    assert.deepEqual(downloads(site.cvSpanishPath), ['CV Juan Manuel Gelay · Product Design Manager (ES).pdf']);
  });

  test(`${name}: the Spanish CV link says the file is in Spanish`, () => {
    const spanish = findLinks(html).filter((link) => link.href === site.cvSpanishPath);
    assert.deepEqual(spanish.map((link) => link.hreflang), ['es']);
  });

  test(`${name}: the contact section shows the current role, location and languages`, () => {
    const who = html.match(/<p\b[^>]*class="[^"]*\bcontact-who\b[^"]*"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? '';
    assert.equal(
      who.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(),
      'Juan Manuel Gelay, Product Design Manager at Auronix. Based in Buenos Aires, Argentina (UTC-3). Languages: Spanish (native), English (B2+), Portuguese (B2).'
    );
  });

  test(`${name}: copying the email sends email-copy`, () => {
    // The minifier may quote the event name with ", ' or a backtick.
    assert.match(html, /track\(\s*["'`]email-copy["'`]\s*\)/);
  });
}
