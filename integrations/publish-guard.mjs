// Fails `astro build` while placeholders remain, so they never reach the live site.
// Placeholders are marked with TODO(juanma) or todo-juanma.
// For a local test build with placeholders: SKIP_PUBLISH_GUARD=1 npm run build
import { readdir, readFile, access } from 'node:fs/promises';
import { join, extname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MARKER = /todo[-(]juanma/i;
const TEXT_EXTENSIONS = new Set(['.astro', '.mdx', '.md', '.ts', '.mjs', '.js', '.css', '.json', '.svg', '.txt', '.html']);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(dir, entry.name);
      return entry.isDirectory() ? walk(path) : [path];
    })
  );
  return files.flat();
}

export default function publishGuard() {
  let root = '';

  return {
    name: 'publish-guard',
    hooks: {
      'astro:config:done': ({ config }) => {
        root = fileURLToPath(config.root);
      },
      'astro:build:start': async ({ logger }) => {
        if (process.env.SKIP_PUBLISH_GUARD === '1') {
          logger.warn('Skipped. Do not deploy this build.');
          return;
        }

        const problems = [];
        const candidates = [
          join(root, 'astro.config.mjs'),
          join(root, 'README.md'),
          join(root, 'LICENSE'),
          ...(await walk(join(root, 'src'))),
          ...(await walk(join(root, 'public'))),
        ];

        for (const file of candidates) {
          if (extname(file) && !TEXT_EXTENSIONS.has(extname(file))) continue;
          const lines = (await readFile(file, 'utf8')).split('\n');
          lines.forEach((line, index) => {
            if (MARKER.test(line)) problems.push(`${relative(root, file)}:${index + 1}  ${line.trim()}`);
          });
        }

        const { site } = await import(pathToFileURL(join(root, 'src/site.config.mjs')).href);
        for (const cvPath of [site.cvPath, site.cvSpanishPath]) {
          try {
            await access(join(root, 'public', cvPath));
          } catch {
            problems.push(`CV not found at public${cvPath}`);
          }
        }

        if (problems.length > 0) {
          throw new Error(`Fix these before publishing:\n${problems.join('\n')}`);
        }
        logger.info('No placeholders left.');
      },
    },
  };
}
