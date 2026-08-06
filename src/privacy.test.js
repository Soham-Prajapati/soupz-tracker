import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { access, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const root = new URL('..', import.meta.url);
const removedAuthoredModules = [
  'academics-patch.json',
  'academics.js',
  'aptitude.js',
  'codeforces.js',
  'dsa.js',
  'dsavideos.js',
  'labs.js',
  'resources.js',
  'schedule.js',
  'tracks.js',
];
const privateCopy = /Semester V|LeetCode Daily Challenge|Parent-teacher meeting|Check attendance on ERP|CE30[1-5]|M132|PR1 Mini Project|theory exams begin/i;

async function readTree(directory) {
  const chunks = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) chunks.push(await readTree(path));
    else if (/\.(?:js|jsx|json|css|html|md|sql)$/.test(entry.name) && !entry.name.endsWith('.test.js')) chunks.push(await readFile(path, 'utf8'));
  }
  return chunks.flat().join('\n');
}

test('authored plan modules are absent and cannot enter the public graph', async () => {
  for (const name of removedAuthoredModules) {
    await assert.rejects(access(new URL(`./data/${name}`, import.meta.url)));
  }
  const graphSources = await Promise.all([
    readFile(new URL('./App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('./main.jsx', import.meta.url), 'utf8'),
    readFile(new URL('./HackathonWorkspace.jsx', import.meta.url), 'utf8'),
  ]);
  assert.doesNotMatch(graphSources.join('\n'), /from\s+['"]\.\/data\//);

  const productSchema = await readFile(new URL('../supabase/migrations/20260724000000_multiuser.sql', import.meta.url), 'utf8');
  assert.doesNotMatch(productSchema, /create table public\.(?:subjects|attendance|exams)\b/i);
  assert.doesNotMatch(productSchema, /\bcollege\b|attendance_threshold|\bCE30[1-5]\b/i);
  const shippedTree = await Promise.all(['src', 'packages', 'mobile/lib', 'mobile/assets', 'supabase']
    .map(path => readTree(join(root.pathname, path))));
  assert.doesNotMatch(shippedTree.join('\n'), privateCopy);
});

test('production bundle contains no known authored-plan or private campaign copy', async t => {
  const output = await mkdtemp(join(tmpdir(), 'soupz-tracker-public-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  execFileSync(process.execPath, [
    'node_modules/vite/bin/vite.js',
    'build',
    '--outDir',
    output,
    '--emptyOutDir',
  ], { cwd: root, stdio: 'pipe' });
  const bundle = await readFile(join(output, 'index.html'), 'utf8');
  assert.doesNotMatch(bundle, privateCopy);
  assert.match(bundle, /Add a habit directly/);
  assert.match(bundle, /Soupz Tracker/);
});

test('PWA bundle and release workflow enforce the same privacy boundary', async t => {
  const output = await mkdtemp(join(tmpdir(), 'soupz-tracker-pwa-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', output, '--emptyOutDir'], {
    cwd: root,
    env: { ...process.env, BUILD_TARGET: 'web' },
    stdio: 'pipe',
  });
  assert.doesNotMatch(await readTree(output), privateCopy);
  const workflow = await readFile(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8');
  assert.match(workflow, /npm test/);
  assert.match(workflow, /releaseDraft:\s*true/);
  assert.match(workflow, /Require Apple signing and notarization credentials/);
});
