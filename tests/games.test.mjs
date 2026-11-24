// Games: the /games/ list, each game's page in three languages and the copy of each game. Issue #17.
// The checks on dist/ need npm run build first. The texts of each page are approved by the PO.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { assertBuilt, isGameCopy, isRedirect, pathForFile } from './site-checks.mjs';
import { LANGS, langFromPath, localizePath, ui } from '../src/i18n.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const gamesDir = join(root, 'src/content/games');
const originals = readdirSync(gamesDir).filter((name) => /\.mdx?$/.test(name));

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
const hasAttribute = (tag, name) => new RegExp(`\\s${name}(?:=|\\s|>|$)`).test(tag);
// /_astro/screenshot.BFPWiNA9_1O08HH.webp -> screenshot: the source file, whatever the size or format.
const stem = (src) => (src ?? '').split('/').pop().split('.')[0];

// Every file under a folder, as paths relative to it.
function files(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => (entry.isDirectory() ? files(join(dir, entry.name)).map((path) => join(entry.name, path)) : [entry.name]))
    .sort();
}

// The frontmatter values of a game file: one "key: value" per line, quotes removed.
function frontmatter(file) {
  const block = readFileSync(file, 'utf8').match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
  return Object.fromEntries(
    [...block.matchAll(/^(\w+):\s*(.*)$/gm)].map(([, key, value]) => [key, value.trim().replace(/^'(.*)'$/, '$1').replace(/''/g, "'")])
  );
}

const readBuilt = (sitePath) => {
  const file = join(dist, decodeURI(sitePath), 'index.html');
  return existsSync(file) ? readFileSync(file, 'utf8') : '';
};

// The CSS a built page uses: its linked stylesheets from the site and its <style> blocks.
function pageCss(html) {
  const linked = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)]
    .map(([, href]) => href)
    .filter((href) => href.startsWith('/') && !href.startsWith('//'))
    .map((href) => readFileSync(join(dist, href), 'utf8'));
  const inline = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map(([, css]) => css);
  return [...linked, ...inline].join('\n');
}

// The JavaScript a built page runs: its module scripts from the site, linked or inline.
function pageScripts(html) {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
    .map(([, attributes, code]) => {
      const src = attribute(` ${attributes}`, 'src');
      if (src?.startsWith('/') && !src.startsWith('//')) return readFileSync(join(dist, src), 'utf8');
      return src ? '' : code;
    })
    .join('\n');
}

// Scenario: cada juego está en los tres idiomas.
test('every game has a Spanish and a Portuguese version', () => {
  assert.ok(originals.length > 0, 'No games in src/content/games/');
  const missing = originals.flatMap((name) =>
    ['es', 'pt'].filter((lang) => !existsSync(join(gamesDir, lang, name))).map((lang) => `src/content/games/${lang}/${name}`)
  );
  assert.deepEqual(missing, []);
});

// The game keeps its admin settings under this key. The site never touches it.
test('the site never uses the localStorage key of Hurlinstein3D', () => {
  const sources = files(join(root, 'src')).filter((path) => /\.(astro|ts|mjs|js|mdx)$/.test(path));
  const users = sources.filter((path) => readFileSync(join(root, 'src', path), 'utf8').includes('hurlinstein3d.settings'));
  assert.deepEqual(users, []);
});

test('the game copy rule only covers the copy', () => {
  assert.equal(isGameCopy('games/hurlinstein3d/game/js/main.js'), true);
  assert.equal(isGameCopy('games/hurlinstein3d/index.html'), false);
});

test('the site is built', () => {
  assertBuilt(dist);
});

const built = existsSync(dist);

for (const name of originals) {
  const slug = name.replace(/\.mdx?$/, '');
  const data = frontmatter(join(gamesDir, name));
  const copy = join(root, 'public/games', slug, 'game');

  if (data.play) {
    // Scenario: el juego se publica tal cual está en su repo.
    test(`${slug}: the copy has its source commit and every file its page uses`, () => {
      assert.ok(existsSync(join(copy, 'index.html')), `No index.html in public/games/${slug}/game/`);
      const source = existsSync(join(copy, 'SOURCE.txt')) ? readFileSync(join(copy, 'SOURCE.txt'), 'utf8') : '';
      assert.match(source, /^[0-9a-f]{40} \d{4}-\d{2}-\d{2} \S.*\n?$/, 'SOURCE.txt is not "<commit> <date> <subject>"');
      for (const field of ['play', 'logo', 'favicon']) {
        if (!data[field]) continue;
        assert.ok(data[field].startsWith(`/games/${slug}/game/`), `${field} is outside the copy: ${data[field]}`);
        assert.ok(existsSync(join(root, 'public', data[field])), `${field} not found: public${data[field]}`);
      }
    });

    test(`${slug}: the build publishes the copy without changing a byte`, { skip: !built }, () => {
      const published = join(dist, 'games', slug, 'game');
      assert.ok(existsSync(published), `No copy in dist/games/${slug}/game/`);
      assert.deepEqual(files(published), files(copy), 'The published copy has other files');
      const changed = files(copy).filter((path) => !readFileSync(join(copy, path)).equals(readFileSync(join(published, path))));
      assert.deepEqual(changed, []);
    });
  }
}

// What a game page shows, to check it and to compare a translation with its original.
function gameParts(html) {
  const headStart = html.search(/<header\b[^>]*class="[^"]*\bpage-head\b/);
  const head = headStart < 0 ? '' : html.slice(headStart, html.indexOf('</header>', headStart));
  const body = html.slice(html.indexOf('class="prose"'), html.indexOf('</article>'));
  const figure = body.match(/<figure\b[\s\S]*?<\/figure>/)?.[0] ?? '';
  return {
    head,
    title: stripTags(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? ''),
    description: decode(html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? ''),
    screenshot: figure.match(/<img\b[^>]*>/)?.[0],
    logo: html.match(/<img\b[^>]*class="[^"]*\bgame-logo\b[^"]*"[^>]*>/)?.[0],
    headings: [...body.matchAll(/<(h[23])\b/g)].map(([, tag]) => tag),
    keys: [...body.matchAll(/<kbd>([\s\S]*?)<\/kbd>/g)].map(([, key]) => key),
    links: [...body.matchAll(/<a\b[^>]*href="(https?:[^"]*)"/g)].map(([, href]) => decode(href)).sort(),
  };
}

// The Space key is named in each language. The rest are the same keys.
const SPACE = { en: 'Space', es: 'Espacio', pt: 'Espaço' };
const sameKeys = (keys, lang) => keys.map((key) => (key === SPACE[lang] ? 'Space' : key));

for (const lang of LANGS) {
  const t = ui[lang];
  const listPath = localizePath('/games/', lang);
  const listHtml = readBuilt(listPath);

  // Scenario: /games/ lista los juegos como /writing/ lista los posts.
  test(`${listPath} shows its title and the intro`, { skip: !built }, () => {
    assert.ok(listHtml && !isRedirect(listHtml), `${listPath} is not a page`);
    assert.equal(stripTags(listHtml.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? ''), t.gamesTitle);
    assert.equal(stripTags(listHtml.match(/<p\b[^>]*class="dek"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? ''), t.gamesIntro);
  });

  const rows = [...listHtml.matchAll(/<li\b[^>]*class="row[^"]*"[^>]*>([\s\S]*?)<\/li>/g)].map(([, row]) => ({
    href: row.match(/<a\b[^>]*href="([^"]*)"/)?.[1],
    title: stripTags(row.match(/<h2\b[^>]*class="row-title"[^>]*>([\s\S]*?)<\/h2>/)?.[1] ?? ''),
    text: stripTags(row.match(/<p\b[^>]*class="row-text"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? ''),
    meta: stripTags(row.match(/<p\b[^>]*class="row-meta"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? ''),
    image: row.match(/<img\b[^>]*>/)?.[0],
  }));

  test(`${listPath}: every game appears once`, { skip: !built }, () => {
    const expected = originals.map((name) => localizePath(`/games/${name.replace(/\.mdx?$/, '')}/`, lang)).sort();
    assert.deepEqual(rows.map((row) => row.href).sort(), expected);
  });

  for (const name of originals) {
    const slug = name.replace(/\.mdx?$/, '');
    const data = frontmatter(join(gamesDir, name));
    const path = localizePath(`/games/${slug}/`, lang);
    const html = readBuilt(path);
    const skip = !html;
    const page = gameParts(html);
    const original = lang === 'en' ? page : gameParts(readBuilt(`/games/${slug}/`));

    test(`${path} is built`, () => {
      assert.ok(html, `No page at ${path}`);
    });

    test(`the row for ${path} shows its title, description, type and screenshot`, { skip }, () => {
      const row = rows.find((item) => item.href === path);
      assert.ok(row, `No row links to ${path}`);
      assert.deepEqual([row.title, row.text, row.meta], [page.title, page.description, t.types[data.type]]);
      assert.equal(stem(attribute(row.image, 'src')), stem(attribute(page.screenshot, 'src')));
      assert.equal(attribute(row.image, 'alt'), attribute(page.screenshot, 'alt'));
    });

    test(`${path}: the screenshot has alt text in the page's language and is the og:image`, { skip }, () => {
      assert.ok(page.screenshot, 'No screenshot');
      assert.ok(attribute(page.screenshot, 'alt')?.trim(), 'The screenshot has no alt text');
      if (lang !== 'en') assert.notEqual(attribute(page.screenshot, 'alt'), attribute(original.screenshot, 'alt'), 'Alt text not translated');
      const og = attribute(html.match(/<meta property="og:image"[^>]*>/)?.[0], 'content');
      assert.ok(og, 'No og:image');
      assert.equal(stem(new URL(og).pathname), stem(attribute(page.screenshot, 'src')));
      assert.ok(existsSync(join(dist, new URL(og).pathname)), `og:image not in the build: ${og}`);
      assert.match(html, /<meta name="twitter:card" content="summary_large_image"/);
    });

    if (data.favicon) {
      test(`${path}: the tab shows the game's favicon`, { skip }, () => {
        const icons = [...html.matchAll(/<link\b[^>]*rel="icon"[^>]*>/g)].map(([tag]) => attribute(tag, 'href'));
        assert.deepEqual(icons, [data.favicon]);
      });
    }

    if (data.logo) {
      test(`${path}: the logo is the game's pixel art, scaled without smoothing`, { skip }, () => {
        assert.equal(attribute(page.logo, 'src'), data.logo);
        assert.ok(attribute(page.logo, 'alt')?.trim(), 'The logo has no alt text');
        assert.match(pageCss(html), /\.game-logo(?:\[[^\]]*\])?\s*\{[^}]*image-rendering:\s*pixelated/);
      });
    }

    if (data.repo) {
      test(`${path}: a link goes to the game's code`, { skip }, () => {
        const link = [...html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)].find(([tag]) => attribute(tag, 'href') === data.repo);
        assert.ok(link, `No link to ${data.repo}`);
        assert.equal(stripTags(link[1]), t.viewCode);
      });
    }

    if (data.play) {
      // Scenario: Play se ve sin scrollear, como acción principal.
      test(`${path}: Play is a real button under the title, before the screenshot`, { skip }, () => {
        const button = page.head.match(/<button\b[^>]*data-game-play-button[^>]*>([\s\S]*?)<\/button>/);
        assert.ok(button, 'Play is not a button in the page head');
        assert.match(button[0], /class="[^"]*\bbutton\b[^"]*\bgame-play-button\b/);
        assert.equal(stripTags(button[1]), t.play);
        assert.equal(attribute(button[0], 'data-umami-event'), 'game-play');
        assert.ok(html.indexOf(button[0]) < html.indexOf('<figure'), 'Play comes after the screenshot');
      });

      // Scenario: Play abre el juego en esta misma página, en pantalla completa.
      test(`${path}: the game waits in a hidden stage, in an iframe with no src and no sandbox`, { skip }, () => {
        const stage = html.match(/<div\b[^>]*id="game-stage"[^>]*>/)?.[0];
        assert.ok(stage && hasAttribute(stage, 'hidden'), 'No hidden #game-stage');
        const frames = [...html.matchAll(/<iframe\b[^>]*>/g)].map(([tag]) => tag);
        assert.equal(frames.length, 1, 'Expected one iframe');
        const [frame] = frames;
        assert.ok(html.indexOf(frame) > html.indexOf(stage), 'The iframe is not in the stage');
        assert.ok(!hasAttribute(frame, 'src'), 'The iframe loads the game before Play');
        assert.ok(!hasAttribute(frame, 'sandbox'), 'A sandbox blocks the mouse capture');
        assert.equal(attribute(frame, 'title'), page.title);
        assert.equal(attribute(frame, 'allow'), 'fullscreen');
        assert.equal(attribute(frame, 'data-game-src'), data.play);
        assert.ok(existsSync(join(dist, data.play)), `The game is not in the build: ${data.play}`);
      });

      // Scenario: Play abre el juego en pantalla completa; Escape vuelve a esta página con una partida nueva cada vez.
      test(`${path}: the script opens the stage in full screen and closes the game when full screen ends`, { skip }, () => {
        const script = pageScripts(html);
        for (const piece of ['requestFullscreen', 'webkitRequestFullscreen', 'fullscreenchange', 'webkitfullscreenchange', 'about:blank', 'Escape']) {
          assert.ok(script.includes(piece), `The page script has no ${piece}`);
        }
        assert.ok(!script.includes('localStorage'), 'The page script uses localStorage');
      });

      // Scenario: en un celular o una tablet sin teclado, Play queda deshabilitado con un aviso.
      test(`${path}: without a fine pointer, Play is disabled with a note`, { skip }, () => {
        const note = html.match(/<p\b[^>]*data-game-play-unavailable[^>]*>([\s\S]*?)<\/p>/);
        assert.ok(note && hasAttribute(note[0], 'hidden'), 'No hidden note for phones and tablets');
        assert.equal(stripTags(note[1]), t.playNeedsKeyboard);
        assert.ok(pageScripts(html).includes('(any-pointer: fine)'), 'The page script does not check for a fine pointer');
      });

      test(`${path}: the hint over the game is in the page's language and lets clicks through`, { skip }, () => {
        const hint = html.match(/<p\b[^>]*data-game-stage-hint[^>]*>([\s\S]*?)<\/p>/);
        assert.ok(hint && hasAttribute(hint[0], 'hidden'), 'No hidden hint');
        assert.equal(stripTags(hint[1]), t.playHint);
        assert.match(pageCss(html), /\.game-stage-hint(?:\[[^\]]*\])?\s*\{[^}]*pointer-events:\s*none/);
      });
    }

    if (lang !== 'en') {
      test(`${path} keeps the original's sections, keys and links, with its own text`, { skip: skip || !original.title }, () => {
        assert.equal(page.title, original.title);
        assert.notEqual(page.description, original.description, 'Description not translated');
        assert.deepEqual(page.headings, original.headings, 'Different headings');
        assert.deepEqual(sameKeys(page.keys, lang), original.keys, 'Different keys');
        assert.deepEqual(page.links, original.links, 'Different links');
        if (original.logo) assert.notEqual(attribute(page.logo, 'alt'), attribute(original.logo, 'alt'), 'Logo alt text not translated');
      });
    }
  }
}

// Scenario: el menú lleva a los juegos desde cualquier página, marcado en el listado y en cada juego.
function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.name.endsWith('.html') ? [path] : [];
  });
}

const pages = built ? htmlFiles(dist).filter((file) => !isGameCopy(relative(dist, file))) : [];

for (const file of pages) {
  const html = readFileSync(file, 'utf8');
  if (isRedirect(html)) continue;
  const path = pathForFile(relative(dist, file));
  const lang = langFromPath(path);
  const games = localizePath('/games/', lang);
  const header = html.slice(html.indexOf('<header'), html.indexOf('</header>'));
  const links = [...header.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].filter(([, , label]) => stripTags(label) === ui[lang].navGames);

  test(`${path}: the menu links to ${ui[lang].navGames}, marked where it applies`, () => {
    assert.equal(links.length, 1, `Exactly one ${ui[lang].navGames} link in the header`);
    const [, attributes] = links[0];
    assert.match(attributes, new RegExp(`\\shref="${games}"`));
    assert.match(attributes, /\sdata-umami-event="nav-games"/);
    const expected = path === games ? 'page' : path.startsWith(games) ? 'true' : undefined;
    assert.equal(attributes.match(/\saria-current="([^"]*)"/)?.[1], expected);
  });
}

// Issue #18: Hurlinstein3D shows its promotional art as its main image, its logo without a background and, further
// down, a screenshot of the game.
const HURLINSTEIN = 'hurlinstein3d';

// The figures in the body of a game page: the <figure> tag and its <img>.
const bodyFigures = (html) =>
  [...html.slice(html.indexOf('class="prose"'), html.indexOf('</article>')).matchAll(/<figure\b[\s\S]*?<\/figure>/g)].map(
    ([figure]) => ({ tag: figure.match(/<figure\b[^>]*>/)[0], img: figure.match(/<img\b[^>]*>/)?.[0] })
  );
const figureOf = (html, name) => bodyFigures(html).find((figure) => stem(attribute(figure.img, 'src')) === name);
// Figure.astro shows an image at most 832px wide (--layout-figure), wider than the text column.
const isLarge = (figure) => /--figure-width:\s*832px/.test(attribute(figure?.tag, 'style') ?? '');

// Scenario: el logo no tiene fondo.
test('the Hurlinstein3D logo is a PNG with an alpha channel and a transparent corner', () => {
  const png = readFileSync(join(root, 'src/assets/games', HURLINSTEIN, 'logo.png'));
  assert.equal(png.subarray(1, 4).toString(), 'PNG', 'Not a PNG');
  // IHDR: bit depth at byte 24 and color type at byte 25; 8-bit color type 6 is RGBA.
  assert.deepEqual([png[24], png[25]], [8, 6], 'Not an 8-bit RGBA PNG');
  const chunks = [];
  for (let at = 8; at < png.length; ) {
    const length = png.readUInt32BE(at);
    if (png.toString('latin1', at + 4, at + 8) === 'IDAT') chunks.push(png.subarray(at + 8, at + 8 + length));
    at += 12 + length;
  }
  // The first byte of a row is its filter. On the first pixel of the first row, every filter keeps the value as it is.
  const pixels = inflateSync(Buffer.concat(chunks));
  assert.equal(pixels[4], 0, 'The top left corner is not transparent');
});

for (const lang of LANGS) {
  const path = localizePath(`/games/${HURLINSTEIN}/`, lang);
  const html = readBuilt(path);
  const original = readBuilt(`/games/${HURLINSTEIN}/`);
  const skip = !html;
  const translated = (name) => {
    if (lang === 'en') return;
    assert.notEqual(attribute(figureOf(html, name)?.img, 'alt'), attribute(figureOf(original, name)?.img, 'alt'), `${name} alt text not translated`);
  };

  // Scenario: la promo reemplaza a la captura como imagen del juego.
  test(`${path}: the promotional art is the main image, large, and the og:image`, { skip }, () => {
    const [main] = bodyFigures(html);
    assert.equal(stem(attribute(main?.img, 'src')), 'promo', 'The first figure is not the promotional art');
    assert.ok(isLarge(main), 'The promotional art is not shown at 832px');
    assert.equal(stem(new URL(attribute(html.match(/<meta property="og:image"[^>]*>/)?.[0], 'content')).pathname), 'promo');
    translated('promo');
  });

  // Scenario: el logo decora la página en grande, sin fondo y sin marco.
  test(`${path}: the logo is shown large, without a frame, in a format that keeps its transparency`, { skip }, () => {
    const logo = figureOf(html, 'logo');
    assert.ok(logo, 'No logo figure');
    assert.ok(attribute(logo.img, 'alt')?.trim(), 'The logo has no alt text');
    assert.match(attribute(logo.tag, 'class'), /\bfigure-frameless\b/);
    assert.match(attribute(logo.img, 'src'), /\.(webp|png|avif)$/, 'The logo lost its transparency');
    assert.ok(isLarge(logo), 'The logo is not shown at 832px');
    assert.match(pageCss(html), /\.figure-frameless(?:\[[^\]]*\])?\s+img\s*\{[^}]*border:\s*0/);
    translated('logo');
  });

  // Scenario: la captura sigue en la página, más abajo.
  test(`${path}: the screenshot of the game is still on the page, after the logo`, { skip }, () => {
    const names = bodyFigures(html).map((figure) => stem(attribute(figure.img, 'src')));
    assert.deepEqual(names, ['promo', 'logo', 'screenshot']);
    assert.ok(attribute(figureOf(html, 'screenshot').img, 'alt')?.trim(), 'The screenshot has no alt text');
    translated('screenshot');
  });
}
