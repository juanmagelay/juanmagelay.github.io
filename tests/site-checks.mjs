// Rules for the built site. Each check takes the HTML of one page and returns
// the problems it finds, so tests can run them on dist/ and on small examples.
import { existsSync } from 'node:fs';

const DASHES = /[\u2013\u2014]|&(?:mdash|ndash);|&#(?:8211|8212);|&#x(?:2013|2014);/gi;

export function assertBuilt(dir) {
  if (!existsSync(dir)) {
    throw new Error(`No built site at ${dir}. Run npm run build first.`);
  }
}

// dist/index.html -> /, dist/games/x/index.html -> /games/x/, dist/404.html -> /404/
export function pathForFile(relativePath) {
  const path = relativePath.split('\\').join('/').replace(/(^|\/)index\.html$/, '$1').replace(/\.html$/, '/');
  return `/${path}`.replace(/\/+/g, '/');
}

export function isRedirect(html) {
  return /<meta\s[^>]*http-equiv="refresh"/i.test(html);
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
  return match ? (match[1] ?? match[2]) : undefined;
}

function decodeEntities(text) {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

export function findImagesWithoutAlt(html) {
  return [...html.matchAll(/<img\b[^>]*>/gi)]
    .filter(([tag]) => !attribute(tag, 'alt')?.trim())
    .map(([tag]) => `Image without alt text: ${attribute(tag, 'src') ?? tag}`);
}

// Script and style blocks are not copy, so dashes there are ignored.
export function findDashes(html) {
  const copy = html.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<style\b[\s\S]*?<\/style>/gi, '');
  return [...copy.matchAll(DASHES)].map((match) => {
    const around = copy.slice(Math.max(0, match.index - 40), match.index + 40).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    return `Dash "${match[0]}" near: ${around.trim()}`;
  });
}

export function checkCanonical(html, expectedUrl) {
  const tag = html.match(/<link\b[^>]*rel="canonical"[^>]*>/i)?.[0];
  if (!tag) return ['Missing canonical link'];
  const href = attribute(tag, 'href');
  return href === expectedUrl ? [] : [`Canonical is ${href}, expected ${expectedUrl}`];
}

export function findCvLinks(html) {
  return [...html.matchAll(/<a\b[^>]*>/gi)]
    .map(([tag]) => attribute(tag, 'href'))
    .filter((href) => href?.startsWith('/cv/'))
    .map((href) => decodeURI(decodeEntities(href)));
}

// fileExists receives a site path such as /cv/file.pdf and says if the build has it.
export function findBrokenCvLinks(html, fileExists) {
  return findCvLinks(html)
    .filter((path) => !fileExists(path))
    .map((path) => `CV link points to a missing file: ${path}`);
}
