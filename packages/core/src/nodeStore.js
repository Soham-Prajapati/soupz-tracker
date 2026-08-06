import { mkdir, open, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { homedir, platform } from 'node:os';
import { dirname, join } from 'node:path';
import { clone } from './validation.js';
import { EMPTY_ENGINE_STATE } from './repository.js';

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function withFileLock(path, operation) {
  const lockPath = `${path}.lock`;
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  for (let attempt = 0; attempt < 250; attempt += 1) {
    let handle;
    try {
      handle = await open(lockPath, 'wx', 0o600);
      try { return await operation(); }
      finally { await handle.close(); await unlink(lockPath).catch(() => {}); }
    } catch (error) {
      if (handle) await handle.close().catch(() => {});
      if (error.code !== 'EEXIST') throw error;
      const age = Date.now() - (await stat(lockPath).catch(() => ({ mtimeMs: Date.now() }))).mtimeMs;
      if (age > 30_000) await unlink(lockPath).catch(() => {});
      else await wait(20);
    }
  }
  throw new Error(`Timed out waiting for Tracker state lock: ${lockPath}`);
}

export function defaultEngineStatePath() {
  if (process.env.SOUPZ_TRACKER_DATA) return process.env.SOUPZ_TRACKER_DATA;
  if (platform() === 'darwin') return join(homedir(), 'Library', 'Application Support', 'com.soupz.tracker', 'engine-state.json');
  const dataRoot = process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share');
  return join(dataRoot, 'soupz-tracker', 'engine-state.json');
}

export class JsonFileRepository {
  constructor(path = defaultEngineStatePath()) {
    this.path = path;
    this.queue = Promise.resolve();
  }

  async read() {
    await this.queue;
    return this.#readUnlocked();
  }

  async update(mutator) {
    const operation = this.queue.then(async () => {
      return withFileLock(this.path, async () => {
        const state = await this.#readUnlocked();
        const result = await mutator(state);
        await this.#writeUnlocked(state);
        return clone(result);
      });
    });
    this.queue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  async #readUnlocked() {
    try {
      const state = JSON.parse(await readFile(this.path, 'utf8'));
      if (state?.schemaVersion !== 1 || !state.plans || !state.progress) throw new Error('Unsupported engine state schema');
      return state;
    } catch (error) {
      if (error.code === 'ENOENT') return clone(EMPTY_ENGINE_STATE);
      throw error;
    }
  }

  async #writeUnlocked(state) {
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    const temporary = `${this.path}.tmp`;
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, this.path);
  }
}
