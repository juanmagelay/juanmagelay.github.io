// Rules for the design system. Each check takes CSS or source text and returns what it finds,
// so tests can run them on the project and on small examples. Issue #6.

const COMMENTS = /\/\*[\s\S]*?\*\//g;
const DARK_ROOT = /@media\s*\(\s*prefers-color-scheme:\s*dark\s*\)\s*\{\s*:root\s*\{([^}]*)\}\s*\}/g;

function declarations(block) {
  return Object.fromEntries([...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]));
}

function resolve(table) {
  const value = (name, seen = new Set()) => {
    if (seen.has(name)) throw new Error(`Circular token: ${name}`);
    const raw = table[name];
    if (raw === undefined) return undefined;
    return raw.replace(/var\(\s*(--[\w-]+)\s*\)/g, (match, ref) => value(ref, new Set([...seen, name])) ?? match);
  };
  return Object.fromEntries(Object.keys(table).map((name) => [name, value(name)]));
}

// Custom properties of tokens.css in each theme, with var() references resolved.
export function parseTokens(css) {
  const clean = css.replace(COMMENTS, '');
  const darkBlocks = [...clean.matchAll(DARK_ROOT)].map(([, block]) => block);
  const lightBlocks = [...clean.replace(DARK_ROOT, '').matchAll(/:root\s*\{([^}]*)\}/g)].map(([, block]) => block);
  const light = Object.assign({}, ...lightBlocks.map(declarations));
  const dark = { ...light, ...Object.assign({}, ...darkBlocks.map(declarations)) };
  return { light: resolve(light), dark: resolve(dark) };
}

function luminance(hex) {
  const digits = hex.replace('#', '');
  const full = digits.length === 3 ? [...digits].map((d) => d + d).join('') : digits;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const channel = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

// WCAG 2 contrast ratio between two hex colors.
export function contrast(foreground, background) {
  const [a, b] = [luminance(foreground), luminance(background)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

// The CSS inside the <style> blocks of an .astro file.
export function astroStyles(source) {
  return [...source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map(([, css]) => css).join('\n');
}

// Colors written as literals. Outside tokens.css, colors must come from a token.
export function findColorLiterals(css) {
  const clean = css.replace(COMMENTS, '');
  const patterns = [/#[0-9a-f]{3,8}\b/gi, /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/gi, /:\s*(?:white|black)\s*[;}]/gi];
  return patterns.flatMap((pattern) => [...clean.matchAll(pattern)].map(([match]) => `Color literal: ${match.trim()}`));
}

// Variables used with var() that nothing defines.
export function findUndefinedVariables(sources, predefined = []) {
  const text = sources.join('\n');
  const defined = new Set([...predefined, ...[...text.matchAll(/(--[\w-]+)\s*:/g)].map(([, name]) => name)]);
  const used = new Set([...text.matchAll(/var\(\s*(--[\w-]+)/g)].map(([, name]) => name));
  return [...used].filter((name) => !defined.has(name)).map((name) => `Undefined variable: ${name}`);
}

// The system has no shadows and no gradients.
export function findShadowsAndGradients(css) {
  return [
    ...[...css.matchAll(/(?:box|text)-shadow\s*:(?!\s*none\s*[;}])[^;}]+/gi)].map(([match]) => `Shadow: ${match}`),
    ...[...css.matchAll(/(?:repeating-)?(?:linear|radial|conic)-gradient\(/gi)].map(([match]) => `Gradient: ${match}`),
  ];
}

// Rules that hide the focus outline.
export function findOutlineRemovals(css) {
  return [...css.matchAll(/\boutline\s*:\s*(?:none|0)\s*(?=[;}])/gi)].map(
    (match) => `Outline removed near: ${css.slice(Math.max(0, match.index - 60), match.index + match[0].length).trim()}`
  );
}

// @font-face rules with their family and source URLs.
export function findFontFaces(css) {
  return [...css.matchAll(/@font-face\s*\{([^}]*)\}/gi)].map(([, body]) => ({
    family: body.match(/font-family\s*:\s*["']?([^"';]+)["']?/i)?.[1] ?? '',
    urls: [...body.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)].map(([, url]) => url),
  }));
}

// The first family named by each --font-* custom property.
export function findFontVariables(css) {
  return Object.fromEntries([...css.matchAll(/(--font-[\w-]+)\s*:\s*["']([^"']+)["']/g)].map(([, name, family]) => [name, family]));
}

// The smallest min-height, in rem, among rules for the .button class.
export function buttonMinHeight(css) {
  const heights = [...css.matchAll(/\.button(?:\[[^\]]*\])?\s*\{([^}]*)\}/g)]
    .map(([, body]) => body.match(/min-height\s*:\s*([\d.]+)rem/)?.[1])
    .filter(Boolean)
    .map(Number);
  return heights.length ? Math.min(...heights) : undefined;
}
