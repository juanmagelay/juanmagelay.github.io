// The publish guard stops the build while a CV is missing. Issue #7.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import publishGuard from '../integrations/publish-guard.mjs';

const logger = { info() {}, warn() {} };

// A minimal project with the files the guard reads and the given CVs in public/cv/.
async function project(t, cvs) {
  const root = await mkdtemp(join(tmpdir(), 'publish-guard-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'src'));
  await mkdir(join(root, 'public', 'cv'), { recursive: true });
  for (const file of ['astro.config.mjs', 'README.md', 'LICENSE']) await writeFile(join(root, file), '');
  await writeFile(
    join(root, 'src', 'site.config.mjs'),
    "export const site = { cvPath: '/cv/English.pdf', cvSpanishPath: '/cv/Spanish.pdf' };\n"
  );
  for (const cv of cvs) await writeFile(join(root, 'public', 'cv', cv), '');
  return root;
}

function build(root) {
  const guard = publishGuard();
  guard.hooks['astro:config:done']({ config: { root: pathToFileURL(`${root}/`) } });
  return guard.hooks['astro:build:start']({ logger });
}

test('with both CVs, the build goes on', async (t) => {
  await assert.doesNotReject(build(await project(t, ['English.pdf', 'Spanish.pdf'])));
});

test('without the English CV, the build fails and names the file', async (t) => {
  await assert.rejects(build(await project(t, ['Spanish.pdf'])), /CV not found at public\/cv\/English\.pdf/);
});

test('without the Spanish CV, the build fails and names the file', async (t) => {
  await assert.rejects(build(await project(t, ['English.pdf'])), /CV not found at public\/cv\/Spanish\.pdf/);
});
