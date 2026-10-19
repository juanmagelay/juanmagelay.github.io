// The thumbnail of every post is its first <Figure>: the same image and the same alt text.
// The /writing/ list uses this, so a new post only needs a <Figure>; there is no thumbnail field.
// MDX comments are skipped, so an image placeholder written as a comment never counts.

// A <Figure ...> tag, allowing > inside quoted or braced attribute values.
const FIGURE_TAG = /<Figure\b(?:[^>"'{}]|"[^"]*"|'[^']*'|\{[^{}]*\})*>/;
const ALT = /\balt=(?:"([^"]*)"|'([^']*)'|\{\s*"([^"]*)"\s*\}|\{\s*'([^']*)'\s*\})/;

/** The import path and alt text of the first <Figure> in an MDX body, or undefined if it has none. */
export function firstFigure(body) {
  const code = body.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  const tag = code.match(FIGURE_TAG)?.[0];
  if (!tag) return undefined;

  const name = tag.match(/\bsrc=\{\s*([A-Za-z_$][\w$]*)\s*\}/)?.[1];
  const alt = tag.match(ALT)?.slice(1).find((value) => value !== undefined);
  if (!name || alt === undefined) return undefined;

  const escaped = name.replace(/\$/g, '\\$');
  const source = code.match(new RegExp(`^import\\s+${escaped}\\s+from\\s+['"]([^'"]+)['"]`, 'm'))?.[1];
  return source ? { source, alt } : undefined;
}

/** The project path of an import made from a post file, e.g. /src/assets/games/x.jpg. */
export function importPath(postFile, source) {
  const parts = `${postFile.split('/').slice(0, -1).join('/')}/${source}`.split('/');
  const resolved = [];
  for (const part of parts) {
    if (part === '..') resolved.pop();
    else if (part && part !== '.') resolved.push(part);
  }
  return `/${resolved.join('/')}`;
}
