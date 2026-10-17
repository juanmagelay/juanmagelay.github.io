// Each rule must fail on an example that breaks it. Issue #1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertBuilt,
  pathForFile,
  isRedirect,
  findImagesWithoutAlt,
  findDashes,
  checkCanonical,
  findCvLinks,
  findBrokenCvLinks,
  findLinks,
  checkAnalytics,
} from './site-checks.mjs';

const SITE = 'https://juanmagelay.github.io';

test('an image without an alt attribute is reported with its source', () => {
  const problems = findImagesWithoutAlt('<p>Text</p><img src="/a.jpg" width="10">');
  assert.equal(problems.length, 1);
  assert.match(problems[0], /\/a\.jpg/);
});

test('an image with an empty alt is reported', () => {
  assert.equal(findImagesWithoutAlt('<img src="/a.jpg" alt="">').length, 1);
  assert.equal(findImagesWithoutAlt('<img src="/a.jpg" alt="   ">').length, 1);
});

test('an image with descriptive alt text passes', () => {
  assert.deepEqual(findImagesWithoutAlt('<img src="/a.jpg" alt="A Human base">'), []);
});

for (const dash of ['\u2014', '\u2013', '&mdash;', '&ndash;', '&#8212;', '&#x2013;']) {
  test(`a visible ${dash} is reported`, () => {
    const problems = findDashes(`<p>Strategy ${dash} heroes</p>`);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /Strategy/);
  });
}

test('a dash inside alt text is reported', () => {
  assert.equal(findDashes('<img src="/a.jpg" alt="Orcs \u2014 humans">').length, 1);
});

test('dashes inside script and style blocks are ignored', () => {
  assert.deepEqual(findDashes('<script>const a = "\u2014";</script><style>/* \u2013 */</style><p>Clean</p>'), []);
});

test('hyphens are not dashes', () => {
  assert.deepEqual(findDashes('<p>12-unit limit, top-down view</p>'), []);
});

test('a page without a canonical link is reported', () => {
  assert.deepEqual(checkCanonical('<head><title>x</title></head>', `${SITE}/games/`), ['Missing canonical link']);
});

test('a canonical to another domain is reported', () => {
  const problems = checkCanonical('<link rel="canonical" href="https://medium.com/@x/post">', `${SITE}/games/`);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /medium\.com/);
});

test('a canonical to the expected URL passes', () => {
  assert.deepEqual(checkCanonical(`<link rel="canonical" href="${SITE}/games/">`, `${SITE}/games/`), []);
});

test('file paths map to site paths', () => {
  assert.equal(pathForFile('index.html'), '/');
  assert.equal(pathForFile('games/index.html'), '/games/');
  assert.equal(pathForFile('games/warcraft-iii-ux-analysis/index.html'), '/games/warcraft-iii-ux-analysis/');
  assert.equal(pathForFile('404.html'), '/404/');
});

test('redirect pages are recognized', () => {
  assert.equal(isRedirect('<meta http-equiv="refresh" content="0;url=/games/x/">'), true);
  assert.equal(isRedirect('<meta name="description" content="x">'), false);
});

test('CV links are decoded before checking them', () => {
  const html = '<a href="/cv/Juan Manuel Gelay - UX &amp; Product Design Manager (English).pdf" download>CV</a>';
  assert.deepEqual(findCvLinks(html), ['/cv/Juan Manuel Gelay - UX & Product Design Manager (English).pdf']);
});

test('a CV link to a missing file is reported', () => {
  const problems = findBrokenCvLinks('<a href="/cv/old.pdf">CV</a>', () => false);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /\/cv\/old\.pdf/);
});

test('a CV link to an existing file passes', () => {
  assert.deepEqual(findBrokenCvLinks('<a href="/cv/cv.pdf">CV</a>', (path) => path === '/cv/cv.pdf'), []);
});

test('a missing build asks to run npm run build', () => {
  assert.throws(() => assertBuilt('/no/such/dist/'), /Run npm run build first/);
});

// Analytics. Issue #2.
const ID = 'f32a0c5f-6eb5-47bd-b237-bba30a666281';
const DOMAIN = 'juanmagelay.github.io';
const umami = (attributes) => `<script defer src="https://cloud.umami.is/script.js" ${attributes}></script>`;

test('with a website ID, the Umami script with that ID and domain passes', () => {
  const html = umami(`data-website-id="${ID}" data-domains="${DOMAIN}"`);
  assert.deepEqual(checkAnalytics(html, { websiteId: ID, domain: DOMAIN }), []);
});

test('with a website ID, a page without the Umami script is reported', () => {
  assert.deepEqual(checkAnalytics('<p>No analytics</p>', { websiteId: ID, domain: DOMAIN }), ['Expected 1 Umami script, found 0']);
});

test('a duplicated Umami script is reported', () => {
  const tag = umami(`data-website-id="${ID}" data-domains="${DOMAIN}"`);
  assert.equal(checkAnalytics(tag + tag, { websiteId: ID, domain: DOMAIN }).length, 1);
});

test('an Umami script with another website ID is reported', () => {
  const problems = checkAnalytics(umami(`data-website-id="other-id" data-domains="${DOMAIN}"`), { websiteId: ID, domain: DOMAIN });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /other-id/);
});

test('an Umami script that also counts local visits is reported', () => {
  assert.equal(checkAnalytics(umami(`data-website-id="${ID}"`), { websiteId: ID, domain: DOMAIN }).length, 1);
  assert.equal(checkAnalytics(umami(`data-website-id="${ID}" data-domains="localhost"`), { websiteId: ID, domain: DOMAIN }).length, 1);
});

test('without a website ID, no Umami script passes', () => {
  assert.deepEqual(checkAnalytics('<p>No analytics</p>', { websiteId: '', domain: DOMAIN }), []);
});

test('without a website ID, an Umami script is reported', () => {
  assert.deepEqual(checkAnalytics(umami('data-website-id=""'), { websiteId: '', domain: DOMAIN }), ['Umami script loads without a website ID']);
});

test('links are read with their event and location', () => {
  const html = '<a href="/cv/A &amp; B.pdf" download data-umami-event="cv-download" data-umami-event-location="header">CV</a><a href="#contact">Contact</a>';
  assert.deepEqual(findLinks(html), [
    { href: '/cv/A & B.pdf', download: undefined, hreflang: undefined, event: 'cv-download', location: 'header', language: undefined },
    { href: '#contact', download: undefined, hreflang: undefined, event: undefined, location: undefined, language: undefined },
  ]);
});

// Issue #7
test('links are read with their download name, language and event language', () => {
  const html = '<a href="/cv/es.pdf" download="CV A &amp; B (ES).pdf" hreflang="es" data-umami-event="cv-download" data-umami-event-language="es">CV</a>';
  assert.deepEqual(findLinks(html), [
    { href: '/cv/es.pdf', download: 'CV A & B (ES).pdf', hreflang: 'es', event: 'cv-download', location: undefined, language: 'es' },
  ]);
});
