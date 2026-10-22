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

// The pixel size of a WebP file, read from its header: lossy (VP8), lossless (VP8L) or extended (VP8X).
// Anything else returns undefined. Issue #15.
export function webpSize(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') return undefined;
  const chunk = buffer.toString('ascii', 12, 16);
  if (chunk === 'VP8 ') return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
  if (chunk === 'VP8L') {
    const bits = buffer.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X') return { width: buffer.readUIntLE(24, 3) + 1, height: buffer.readUIntLE(27, 3) + 1 };
  return undefined;
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

// Every link with its decoded href, download name, language and the Umami event it sends, if any.
export function findLinks(html) {
  return [...html.matchAll(/<a\b[^>]*>/gi)].map(([tag]) => {
    const download = attribute(tag, 'download');
    return {
      href: decodeURI(decodeEntities(attribute(tag, 'href') ?? '')),
      download: download === undefined ? undefined : decodeEntities(download),
      hreflang: attribute(tag, 'hreflang'),
      event: attribute(tag, 'data-umami-event'),
      location: attribute(tag, 'data-umami-event-location'),
      language: attribute(tag, 'data-umami-event-language'),
    };
  });
}

export function findCvLinks(html) {
  return findLinks(html)
    .map((link) => link.href)
    .filter((href) => href.startsWith('/cv/'));
}

// With a website ID: exactly one Umami script, with that ID, limited to the site's domain.
// Without one: no Umami script at all.
export function checkAnalytics(html, { websiteId, domain }) {
  const scripts = [...html.matchAll(/<script\b[^>]*>/gi)]
    .map(([tag]) => tag)
    .filter((tag) => (attribute(tag, 'src') ?? '').includes('cloud.umami.is/script.js'));

  if (!websiteId) {
    return scripts.length > 0 ? ['Umami script loads without a website ID'] : [];
  }
  if (scripts.length !== 1) return [`Expected 1 Umami script, found ${scripts.length}`];

  const problems = [];
  const id = attribute(scripts[0], 'data-website-id');
  const domains = attribute(scripts[0], 'data-domains');
  if (id !== websiteId) problems.push(`Umami website ID is ${id}, expected ${websiteId}`);
  if (domains !== domain) problems.push(`Umami data-domains is ${domains}, expected ${domain}`);
  return problems;
}

// fileExists receives a site path such as /cv/file.pdf and says if the build has it.
export function findBrokenCvLinks(html, fileExists) {
  return findCvLinks(html)
    .filter((path) => !fileExists(path))
    .map((path) => `CV link points to a missing file: ${path}`);
}
