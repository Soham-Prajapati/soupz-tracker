import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';

const readRepoFile = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const readRepoBytes = path => readFile(new URL(`../${path}`, import.meta.url));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

test('Tracker ships with the updater removed from every runtime surface', async () => {
  const config = JSON.parse(await readRepoFile('src-tauri/tauri.conf.json'));
  const capability = JSON.parse(await readRepoFile('src-tauri/capabilities/default.json'));
  const packageJson = JSON.parse(await readRepoFile('package.json'));
  const packageLock = await readRepoFile('package-lock.json');
  const cargoToml = await readRepoFile('src-tauri/Cargo.toml');
  const cargoLock = await readRepoFile('src-tauri/Cargo.lock');
  const rustSource = await readRepoFile('src-tauri/src/lib.rs');
  const appSource = await readRepoFile('src/App.jsx');
  const releaseWorkflow = await readRepoFile('.github/workflows/release.yml');

  assert.equal(config.bundle.createUpdaterArtifacts, undefined);
  assert.equal(config.plugins?.updater, undefined);
  assert.equal(packageJson.dependencies?.['@tauri-apps/plugin-updater'], undefined);
  assert.doesNotMatch(packageLock, /@tauri-apps\/plugin-updater/);
  assert.equal(capability.permissions.some(permission => permission.startsWith('updater:')), false);
  assert.doesNotMatch(cargoToml, /tauri-plugin-updater/);
  assert.doesNotMatch(cargoLock, /tauri-plugin-updater/);
  assert.doesNotMatch(rustSource, /tauri_plugin_updater|check_for_update|install_update|updater:\/\/progress/);
  assert.doesNotMatch(appSource, /useUpdater|UpdateToast|check_for_update|install_update|updater:\/\/progress/);
  assert.doesNotMatch(releaseWorkflow, /TAURI_SIGNING_PRIVATE_KEY|updater artifact/);
  await assert.rejects(access(new URL('../public/latest.json', import.meta.url)));
});

test('Tracker tray uses the canonical Soupz SVG without geometry drift', async () => {
  const source = await readRepoBytes('src-tauri/icons/tray-source.svg');
  const raster = await readRepoBytes('src-tauri/icons/tray.png');

  assert.equal(sha256(source), '869ec9c9cefe64897ab71810f7f6ce7dd0242c83cb22bc41809173202270d075');
  assert.equal(sha256(raster), '3e0363d48e30818ef1df4d78b0e435b90e98987460ef9d847ecbd2d2ad2632b6');
  assert.deepEqual([...raster.subarray(1, 4)], [0x50, 0x4e, 0x47]);
  assert.equal(raster.readUInt32BE(16), 44);
  assert.equal(raster.readUInt32BE(20), 44);
});
