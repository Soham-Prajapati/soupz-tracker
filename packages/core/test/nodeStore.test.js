import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonFileRepository } from '../src/nodeStore.js';
import { TrackerEngine, createHabitPlan } from '../src/index.js';

test('JSON repository atomically survives a new repository instance', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'soupz-engine-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'state.json');
  const first = new JsonFileRepository(path);
  await first.update(state => { state.plans.example = { id: 'example' }; });
  const reopened = new JsonFileRepository(path);
  assert.deepEqual((await reopened.read()).plans, { example: { id: 'example' } });
});

test('separate repository instances serialize concurrent plan creates', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'soupz-engine-lock-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'state.json');
  const plans = ['One', 'Two'].map(title => createHabitPlan({ title, from: '2026-08-01' }));
  await Promise.all(plans.map(plan => new TrackerEngine(new JsonFileRepository(path)).writePlan({ plan, mode: 'create' })));
  const state = await new JsonFileRepository(path).read();
  assert.deepEqual(Object.keys(state.plans).sort(), plans.map(plan => plan.id).sort());
});
