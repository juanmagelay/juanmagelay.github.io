// Checks for the /writing/ list, its thumbnails and the Writing menu link. Run npm run build first. Issue #10.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertBuilt, isRedirect, pathForFile } from './site-checks.mjs';
import { firstFigure, importPath } from '../src/lib/first-figure.mjs';

// The thumbnail rule: each case must fail on an example that breaks it.

test('the first <Figure> gives the thumbnail image and alt text', () => {
  const body = `import Figure from '../../components/Figure.astro';
import hero from '../../assets/games/x/hero.jpg';
import other from '../../assets/games/x/other.jpg';

<Figure src={hero} loading="eager" alt="A hero's portrait > the map" />

<Figure src={other} alt="Another image" />`;
  assert.deepEqual(firstFigure(body), { source: '../../assets/games/x/hero.jpg', alt: "A hero's portrait > the map" });
});

test('a <Figure> inside an MDX comment is not the thumbnail', () => {
  const body = `import later from '../../assets/games/x/later.jpg';

{/* TODO(juanma): <Figure src={missing} alt="Pending" /> */}

<Figure src={later} alt="The first real image" />`;
  assert.deepEqual(firstFigure(body), { source: '../../assets/games/x/later.jpg', alt: 'The first real image' });
});

test('a post without a <Figure>, alt text or import has no thumbnail', () => {
  assert.equal(firstFigure('Just text, no images.'), undefined);
  assert.equal(firstFigure(`import a from './a.jpg';\n\n<Figure src={a} />`), undefined);
  assert.equal(firstFigure('<Figure src={a} alt="No import" />'), undefined);
});

test('an import path resolves from the post file', () => {
  assert.equal(
    importPath('src/content/games/post.mdx', '../../assets/games/x/hero.jpg'),
    '/src/assets/games/x/hero.jpg'
  );
});

// Checks on the built site.
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const page = join(dist, 'writing/index.html');
const html = existsSync(page) ? readFileSync(page, 'utf8') : '';

test('the writing page is built', () => {
  assertBuilt(page);
});

const skip = !html;

const decode = (text) =>
  text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
const stripTags = (fragment) => decode(fragment.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
const read = (sitePath) => readFileSync(join(dist, sitePath, 'index.html'), 'utf8');
const attribute = (tag, name) => decode(tag?.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1] ?? '');
// /_astro/main-image.BFPWiNA9_1O08HH.webp -> main-image: the source file, whatever the size or format.
const stem = (src) => src.split('/').pop().split('.')[0];

const rows = [...html.matchAll(/<li\b[^>]*class="row[^"]*"[^>]*>([\s\S]*?)<\/li>/g)].map(([, row]) => ({
  href: row.match(/<a\b[^>]*href="([^"]*)"/)?.[1],
  title: stripTags(row.match(/<h2\b[^>]*class="row-title"[^>]*>([\s\S]*?)<\/h2>/)?.[1] ?? ''),
  text: stripTags(row.match(/<p\b[^>]*class="row-text"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? ''),
  meta: stripTags(row.match(/<p\b[^>]*class="row-meta"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? ''),
  image: row.match(/<img\b[^>]*>/)?.[0],
}));

// What each post page says about itself, to compare with its row.
function post(sitePath) {
  const postHtml = read(sitePath);
  const body = postHtml.slice(postHtml.indexOf('class="prose"'));
  return {
    title: stripTags(postHtml.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? ''),
    description: decode(postHtml.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? ''),
    type: stripTags(postHtml.match(/<dt\b[^>]*>Type<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/)?.[1] ?? ''),
    published: postHtml.match(/<meta property="article:published_time" content="([^"]*)"/)?.[1],
    firstImage: body.match(/<img\b[^>]*>/)?.[0],
  };
}

// Scenario: la página lista los posts del más nuevo al más antiguo.
test('the page shows the Writing title and the intro', { skip }, () => {
  assert.equal(stripTags(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? ''), 'Writing');
  assert.equal(
    stripTags(html.match(/<p\b[^>]*class="dek"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? ''),
    'Where I write about UX: the products I design and the games I study.'
  );
});

test('posts go from newest to oldest, and posts from the same day by title', { skip }, () => {
  const listed = rows.map((row) => ({ ...post(row.href), href: row.href }));
  const sorted = [...listed].sort(
    (a, b) => Date.parse(b.published) - Date.parse(a.published) || a.title.localeCompare(b.title)
  );
  assert.ok(listed.every((item) => item.published), 'Every post page has a publication date');
  assert.deepEqual(listed.map((item) => item.href), sorted.map((item) => item.href));
});

// Scenario: cada fila lleva a su post, con la primera imagen del post como miniatura.
const postPaths = existsSync(join(dist, 'games'))
  ? readdirSync(join(dist, 'games'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(join(dist, 'games', entry.name, 'index.html')))
      .map((entry) => `/games/${entry.name}/`)
      .filter((sitePath) => !isRedirect(read(sitePath)))
  : [];

test('every published post appears once', { skip }, () => {
  assert.ok(postPaths.length > 0, 'No posts in the build');
  assert.deepEqual(rows.map((row) => row.href).sort(), [...postPaths].sort());
});

for (const sitePath of postPaths) {
  test(`the row for ${sitePath} shows its title, description and type`, { skip }, () => {
    const row = rows.find((item) => item.href === sitePath);
    assert.ok(row, `No row links to ${sitePath}`);
    const { title, description, type } = post(sitePath);
    assert.deepEqual([row.title, row.text, row.meta], [title, description, type]);
  });

  test(`the thumbnail for ${sitePath} is the post's first image, with its alt text`, { skip }, () => {
    const row = rows.find((item) => item.href === sitePath);
    const { firstImage } = post(sitePath);
    assert.ok(firstImage, `${sitePath} has no image: every post needs a <Figure> for its thumbnail`);
    assert.ok(row?.image, `The row for ${sitePath} has no thumbnail`);
    assert.equal(stem(attribute(row.image, 'src')), stem(attribute(firstImage, 'src')));
    assert.equal(attribute(row.image, 'alt'), attribute(firstImage, 'alt'));
  });
}

// Scenario: /games/ sigue funcionando y lleva a la lista.
test('/games/ redirects to /writing/', () => {
  const games = join(dist, 'games/index.html');
  assertBuilt(games);
  const redirect = readFileSync(games, 'utf8');
  assert.ok(isRedirect(redirect), '/games/ is not a redirect');
  assert.match(redirect, /url=\/writing\/"/);
});

// Scenario: el menú lleva a Writing desde cualquier página. Also: Writing se marca en su página y en los posts.
function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.name.endsWith('.html') ? [path] : [];
  });
}

const pages = existsSync(dist) ? htmlFiles(dist) : [];

for (const file of pages) {
  const pageHtml = readFileSync(file, 'utf8');
  if (isRedirect(pageHtml)) continue;
  const path = pathForFile(relative(dist, file));
  const header = pageHtml.slice(pageHtml.indexOf('<header'), pageHtml.indexOf('</header>'));
  const links = [...header.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].filter(([, , label]) => stripTags(label) === 'Writing');

  test(`${path}: the menu links to Writing with the nav-writing event`, () => {
    assert.equal(links.length, 1, 'Exactly one Writing link in the header');
    const [, attributes] = links[0];
    assert.match(attributes, /\shref="\/writing\/"/);
    assert.match(attributes, /\sdata-umami-event="nav-writing"/);
  });

  // The current page on /writing/, the current section on a post, and nothing elsewhere.
  test(`${path}: Writing is marked as the current page or section where it applies`, () => {
    const expected = path === '/writing/' ? 'page' : path.startsWith('/games/') ? 'true' : undefined;
    const marked = links[0]?.[1].match(/\saria-current="([^"]*)"/)?.[1];
    assert.equal(marked, expected);
  });
}
