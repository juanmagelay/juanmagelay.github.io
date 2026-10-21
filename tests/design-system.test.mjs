// The design system on the site: fonts, palette, contrast, tokens and visual rules. Issue #6.
// The checks on dist/ need npm run build first. Content stays covered by article.test.mjs and dist.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../astro.config.mjs';
import { assertBuilt, isRedirect } from './site-checks.mjs';
import {
  parseTokens,
  contrast,
  astroStyles,
  findColorLiterals,
  findUndefinedVariables,
  findShadowsAndGradients,
  findOutlineRemovals,
  findFontFaces,
  findFontVariables,
  buttonMinHeight,
  classDeclarations,
} from './design-checks.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const tokensPath = join(root, 'src/styles/tokens.css');
const tokens = parseTokens(readFileSync(tokensPath, 'utf8'));

function files(dir, extensions) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return files(path, extensions);
    return extensions.some((extension) => entry.name.endsWith(extension)) ? [path] : [];
  });
}

// Each rule must fail on an example that breaks it.

test('tokens resolve per theme, following var() to the dark primitives', () => {
  const { light, dark } = parseTokens(`
    :root { --a: #111111; --a-on-dark: #EEEEEE; }
    @media (prefers-color-scheme: dark) { :root { --a: var(--a-on-dark); } }
    :root { --ring: 2px solid var(--a); }
  `);
  assert.equal(light['--a'], '#111111');
  assert.equal(dark['--a'], '#EEEEEE');
  assert.equal(dark['--ring'], '2px solid #EEEEEE');
});

test('contrast follows WCAG 2', () => {
  assert.equal(contrast('#000000', '#FFFFFF'), 21);
  assert.ok(contrast('#777777', '#FFFFFF') < 4.5);
});

test('color literals are reported, tokens and white-space are not', () => {
  assert.equal(findColorLiterals('a { color: #2a44d4; }').length, 1);
  assert.equal(findColorLiterals('a { background: rgb(0 0 0 / 0.4); }').length, 1);
  assert.equal(findColorLiterals('a { color: white; }').length, 1);
  assert.deepEqual(findColorLiterals('a { color: var(--color-ink); white-space: nowrap; background: transparent; }'), []);
});

test('a variable nobody defines is reported', () => {
  assert.deepEqual(findUndefinedVariables(['a { color: var(--color-ink-muted); }'], []), ['Undefined variable: --color-ink-muted']);
  assert.deepEqual(findUndefinedVariables([':root { --x: 1px; }', 'a { margin: var(--x); }']), []);
});

test('shadows and gradients are reported, box-shadow: none is not', () => {
  assert.equal(findShadowsAndGradients('a { box-shadow: 0 12px 24px -12px rgb(0 0 0 / 0.45); }').length, 1);
  assert.equal(findShadowsAndGradients('a { background: linear-gradient(red, blue); }').length, 1);
  assert.deepEqual(findShadowsAndGradients('a { box-shadow: none; }'), []);
});

test('a rule that hides the focus outline is reported', () => {
  assert.equal(findOutlineRemovals('a:focus-visible{outline:none}').length, 1);
  assert.deepEqual(findOutlineRemovals(':focus-visible{outline:var(--focus-ring);outline-offset:0}'), []);
});

test('font faces and font variables are read with their family', () => {
  const css = '@font-face{font-family:"Inter-1a2b";src:url("/_astro/fonts/x.woff2") format("woff2")}:root{--font-text:"Inter-1a2b",sans-serif}';
  assert.deepEqual(findFontFaces(css), [{ family: 'Inter-1a2b', urls: ['/_astro/fonts/x.woff2'] }]);
  assert.deepEqual(findFontVariables(css), { '--font-text': 'Inter-1a2b' });
});

test('the button height is read from the .button rule only', () => {
  assert.equal(buttonMinHeight('.button[data-x]{min-height:2.75rem}.button-quiet{min-height:1rem}'), 2.75);
  assert.equal(buttonMinHeight('.card{min-height:2rem}'), undefined);
});

test('class rules are read outside media queries or inside the one asked for', () => {
  const css = '.a{top:0}@media (width<40rem){.b .a[data-x]{width:1rem}}@media (width >= 56rem){.a{width:2rem}}.ab{left:0}.a:hover{right:0}';
  assert.equal(classDeclarations(css, 'a'), 'top:0');
  assert.equal(classDeclarations(css, 'a', 'width<40rem'), 'width:1rem');
  assert.equal(classDeclarations(css, 'a', 'width>=56rem'), 'width:2rem');
  assert.equal(classDeclarations(css, 'c'), '');
});

// Scenario: los colores de marca coinciden con el design system en los dos temas.
const PALETTE = {
  light: { ink: '#14161B', 'text-secondary': '#565C68', accent: '#2A44D4', border: '#D5D8DE', paper: '#FFFFFF' },
  dark: { ink: '#FFFFFF', 'text-secondary': '#B6BBC6', accent: '#7D8FFF', border: '#2E323C', paper: '#14161B' },
};

for (const [theme, colors] of Object.entries(PALETTE)) {
  for (const [token, value] of Object.entries(colors)) {
    test(`${theme} theme: --color-${token} is ${value}`, () => {
      assert.equal(tokens[theme][`--color-${token}`]?.toUpperCase(), value);
    });
  }
}

// Scenario: el texto cumple contraste AA en los dos temas.
const PAIRS = [
  ['ink', 'paper', 'body text'],
  ['text-secondary', 'paper', 'metadata and captions'],
  ['accent', 'paper', 'dek, section titles and hover'],
  ['paper', 'ink', 'primary button'],
  ['paper', 'accent', 'button on hover'],
];

for (const theme of ['light', 'dark']) {
  for (const [text, background, use] of PAIRS) {
    test(`${theme} theme: ${text} on ${background} (${use}) reaches 4.5:1`, () => {
      const ratio = contrast(tokens[theme][`--color-${text}`], tokens[theme][`--color-${background}`]);
      assert.ok(ratio >= 4.5, `Contrast is ${ratio.toFixed(2)}:1`);
    });
  }
}

// Scenario: un color de marca se cambia en un solo lugar.
const sources = files(join(root, 'src'), ['.astro', '.css']);

test('colors are only written in tokens.css', () => {
  const problems = sources
    .filter((path) => path !== tokensPath)
    .flatMap((path) => {
      const source = readFileSync(path, 'utf8');
      const css = path.endsWith('.astro') ? astroStyles(source) : source;
      return findColorLiterals(css).map((problem) => `${relative(root, path)}: ${problem}`);
    });
  assert.deepEqual(problems, []);
});

test('every variable used in the styles is defined', () => {
  const fontVariables = (config.fonts ?? []).map((font) => font.cssVariable);
  assert.deepEqual(findUndefinedVariables(sources.map((path) => readFileSync(path, 'utf8')), fontVariables), []);
});

test('the focus ring is 2px in the accent color', () => {
  assert.equal(tokens.light['--focus-ring'], `2px solid ${PALETTE.light.accent}`);
});

// Checks on the built site.
test('the site is built', () => {
  assertBuilt(dist);
});

const pages = existsSync(dist) ? files(dist, ['.html']) : [];
const FAMILIES = { '--font-voice': 'Bricolage Grotesque', '--font-text': 'Schibsted Grotesk', '--font-data': 'JetBrains Mono' };

for (const file of pages) {
  const name = relative(dist, file);
  const html = readFileSync(file, 'utf8');
  if (isRedirect(html)) continue;

  // Stylesheets from other origins aren't read here: the Google Fonts check reports them.
  const linked = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)]
    .map(([, href]) => href)
    .filter((href) => href.startsWith('/') && !href.startsWith('//'))
    .map((href) => readFileSync(join(dist, href), 'utf8'));
  const inline = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map(([, css]) => css);
  const css = [...linked, ...inline].join('\n');

  // Scenario: las tres familias se sirven desde el propio sitio.
  test(`${name}: each font variable uses its family from the design system`, () => {
    const variables = findFontVariables(css);
    for (const [variable, family] of Object.entries(FAMILIES)) {
      assert.ok(variables[variable]?.startsWith(family), `${variable} is ${variables[variable]}, expected ${family}`);
    }
  });

  test(`${name}: every font file is served from the site`, () => {
    const faces = findFontFaces(css).filter((face) => face.urls.length > 0);
    for (const family of Object.values(FAMILIES)) {
      assert.ok(faces.some((face) => face.family.startsWith(family)), `No @font-face for ${family}`);
    }
    for (const url of faces.flatMap((face) => face.urls)) {
      assert.ok(url.startsWith('/') && !url.startsWith('//'), `Font from another origin: ${url}`);
      assert.ok(existsSync(join(dist, url)), `Font file missing from the build: ${url}`);
    }
  });

  test(`${name}: no request to Google Fonts`, () => {
    assert.doesNotMatch(html + css, /fonts\.(?:googleapis|gstatic)\.com/);
  });

  // Scenario: el diseño respeta las reglas visuales del sistema.
  test(`${name}: the published CSS follows the theme of the operating system`, () => {
    assert.match(css, /prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{[^}]*--color-accent:\s*var\(--color-accent-on-dark\)/);
  });

  test(`${name}: focus is visible with the focus ring`, () => {
    assert.match(css, /:focus-visible\s*\{[^}]*outline:\s*var\(--focus-ring\)/);
    assert.deepEqual(findOutlineRemovals(css), []);
  });

  test(`${name}: no shadows and no gradients`, () => {
    assert.deepEqual(findShadowsAndGradients(css), []);
  });

  test(`${name}: every button is a .button at least 44px high`, () => {
    for (const [tag] of html.matchAll(/<button\b[^>]*>/g)) {
      assert.match(tag, /class="[^"]*\bbutton\b/, `Button without the .button style: ${tag}`);
    }
    assert.ok(buttonMinHeight(css) >= 2.75, `.button min-height is ${buttonMinHeight(css)}rem, expected 2.75rem (44px)`);
  });

  // Scenario: el artículo se lee en una columna central.
  if (html.includes('article-body')) {
    test(`${name}: every block of the body is centered in the reading column`, () => {
      assert.match(html, /class="[^"]*\bcontainer-reading\b[^"]*\barticle-body\b/, 'The article body is not in the reading column');
      assert.match(css, /\.container-reading\s*\{[^}]*max-width:\s*calc\(\s*var\(--layout-figure\)/);
      assert.match(css, /\.container-reading\s+\.prose\s*>\s*\*\s*\{[^}]*margin-inline:\s*auto/);
    });
  }

  // The game's fact sheet stays in the right column of the head, at the container's edge.
  if (html.includes('class="fact-sheet')) {
    test(`${name}: the fact sheet sits in the head's right column`, () => {
      assert.match(html, /class="[^"]*\bpage-head-with-aside\b/);
      assert.match(css, /\.page-head-with-aside(?:\[[^\]]*\])?\s*\{[^}]*grid-template-columns:\s*minmax\(0(?:px)?,\s*1fr\)\s*14rem/);
    });
  }

  // The fact sheet cover: the template's 2:3 frame, 7rem wide on small screens and 14rem from 56rem.
  const cover = html.match(/<img\b[^>]*\bclass="[^"]*\bfact-sheet-image\b[^"]*"[^>]*>/)?.[0];
  if (cover) {
    test(`${name}: the cover fills the 2:3 frame without stretching, at 1x to 3x`, () => {
      const widths = [...(cover.match(/srcset="([^"]*)"/)?.[1] ?? '').matchAll(/\s(\d+)w\b/g)].map(([, width]) => Number(width));
      assert.deepEqual(widths.sort((a, b) => a - b), [112, 224, 336, 448]);
      assert.match(cover, /\bsizes="\(min-width: 56rem\) 14rem, 7rem"/);
      const rule = css.match(/\.fact-sheet-image\s*\{([^}]*)\}/)?.[1] ?? '';
      assert.match(rule, /aspect-ratio:\s*2\s*\/\s*3/);
      assert.match(rule, /object-fit:\s*cover/);
    });
  }

  // Issue #12. Scenario: el footer se acomoda al ancho de la pantalla.
  if (html.includes('id="contact"')) {
    // From 64rem: below it, the left column can't hold the email and the copy button on one line.
    test(`${name}: the footer has one column, and two from 64rem`, () => {
      const base = classDeclarations(css, 'contact');
      assert.match(base, /display:\s*grid/);
      assert.doesNotMatch(base, /grid-template-columns/);
      assert.equal(classDeclarations(css, 'contact', 'width>=56rem'), '', 'The footer has two columns from 56rem');
      assert.match(classDeclarations(css, 'contact', 'width>=64rem'), /grid-template-columns:\s*minmax\(0(?:px)?,\s*1fr\)\s*minmax\(0(?:px)?,\s*1fr\)/);
    });

    test(`${name}: the footer lead is in the Lead style and the name in the accent`, () => {
      const lead = classDeclarations(css, 'contact-lead');
      assert.match(lead, /font-family:\s*var\(--font-text\)/);
      assert.match(lead, /font-size:\s*var\(--type-size-lead\)/);
      assert.doesNotMatch(lead, /font-weight/);
      assert.match(classDeclarations(css, 'contact-name'), /color:\s*var\(--color-accent\)/);
    });

    // Scenario: el botón solo ícono sigue siendo usable.
    test(`${name}: the copy button shows icon and text, and only the 44px icon under 40rem`, () => {
      assert.match(classDeclarations(css, 'copy-email-button'), /gap:\s*var\(--space-1\)/);
      assert.equal(classDeclarations(css, 'copy-email-label'), '', 'The label has styles outside the under-40rem rule');
      assert.match(classDeclarations(css, 'copy-email-button', 'width<40rem'), /width:\s*2\.75rem/);
      const label = classDeclarations(css, 'copy-email-label', 'width<40rem');
      assert.match(label, /position:\s*absolute/);
      assert.match(label, /clip:\s*rect\(0 0 0 0\)/);
    });
  }
}
