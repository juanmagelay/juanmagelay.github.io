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
