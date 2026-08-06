import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyStoreChange,
  createTrackerStateClient,
  createWindowStoreSync,
  makeStoreChange,
} from './windowStore.js';

function canonicalTauriHarness(initial, { staleFirstApply = false } = {}) {
  let state = structuredClone(initial);
  let injectStale = staleFirstApply;
  let applyCalls = 0;
  const listeners = new Set();
  const emit = () => listeners.forEach(listener => listener({ payload: structuredClone(state) }));
  return {
    events: {
      async listen(_event, listener) { listeners.add(listener); return () => listeners.delete(listener); },
    },
    core: {
      async invoke(command, args = {}) {
        if (command === 'migrate_tracker_state') {
          if (!state.migratedLocalStorage) {
            state = {
              ...state,
              revision: state.revision + 1,
              migratedLocalStorage: true,
              done: { ...state.done, ...args.legacyDone },
              pushed: { ...state.pushed, ...args.legacyPushed },
            };
            emit();
          }
          return { applied: true, stale: false, state: structuredClone(state) };
        }
        if (command === 'apply_tracker_patch') {
          applyCalls += 1;
          if (injectStale) {
            injectStale = false;
            state = { ...state, revision: state.revision + 1, done: { ...state.done, other: true } };
          }
          if (args.expectedRevision !== state.revision) {
            return { applied: false, stale: true, state: structuredClone(state) };
          }
          state = {
            ...state,
            revision: state.revision + 1,
            done: { ...state.done, ...args.done },
            pushed: { ...state.pushed, ...args.pushed },
          };
          emit();
          return { applied: true, stale: false, state: structuredClone(state) };
        }
        throw new Error(`unexpected command ${command}`);
      },
    },
    get applyCalls() { return applyCalls; },
  };
}

function tauriEventHarness() {
  const listeners = new Map();
  return {
    async listen(event, listener) {
      const group = listeners.get(event) || new Set();
      group.add(listener);
      listeners.set(event, group);
      return () => group.delete(listener);
    },
    async emit(event, payload) {
      for (const listener of listeners.get(event) || []) listener({ payload });
    },
  };
}

function connectWindow(source, events, initial) {
  const sync = createWindowStoreSync({
    runtime: { __TAURI_INTERNALS__: {} },
    loadTauriEvents: async () => events,
    source,
  });
  let done = { ...initial };
  sync.subscribe(change => {
    if (change.key === 'done') done = applyStoreChange(done, change);
  });
  return {
    sync,
    get done() { return done; },
    async set(id, completed) {
      const next = { ...done, [id]: completed };
      const change = makeStoreChange('done', done, next);
      done = next;
      await sync.publish(change);
    },
  };
}

test('Tauri main and tray propagate completion changes in both directions', async () => {
  const events = tauriEventHarness();
  const initial = { 'task-kept': true, 'task-main': false, 'task-panel': false };
  const main = connectWindow('main', events, initial);
  const panel = connectWindow('panel', events, initial);
  await Promise.all([main.sync.ready, panel.sync.ready]);

  await main.set('task-main', true);
  assert.deepEqual(panel.done, { ...initial, 'task-main': true });

  await panel.set('task-panel', true);
  assert.deepEqual(main.done, {
    ...initial,
    'task-main': true,
    'task-panel': true,
  });

  await panel.set('task-main', false);
  assert.equal(main.done['task-main'], false);
  assert.equal(main.done['task-kept'], true, 'unrelated task ids and values survive');

  main.sync.close();
  panel.sync.close();
});

test('concurrent ticks merge by task id instead of replacing a stale map', async () => {
  const events = tauriEventHarness();
  const initial = { a: false, b: false };
  const main = connectWindow('main', events, initial);
  const panel = connectWindow('panel', events, initial);
  await Promise.all([main.sync.ready, panel.sync.ready]);

  await Promise.all([main.set('a', true), panel.set('b', true)]);

  assert.deepEqual(main.done, { a: true, b: true });
  assert.deepEqual(panel.done, { a: true, b: true });

  main.sync.close();
  panel.sync.close();
});

test('Tauri windows share hackathon mode and plan revisions as replacement documents', async () => {
  const events = tauriEventHarness();
  const main = createWindowStoreSync({
    runtime: { __TAURI_INTERNALS__: {} }, loadTauriEvents: async () => events, source: 'main-plan',
  });
  const panel = createWindowStoreSync({
    runtime: { __TAURI_INTERNALS__: {} }, loadTauriEvents: async () => events, source: 'panel-plan',
  });
  let panelMode = 'standard';
  let panelPlan = null;
  panel.subscribe(change => {
    if (change.key === 'trackerMode') panelMode = applyStoreChange(panelMode, change);
    if (change.key === 'hackathonPlan') panelPlan = applyStoreChange(panelPlan, change);
  });
  await Promise.all([main.ready, panel.ready]);

  const plan = { schemaVersion: 1, id: 'pln_test', revision: 1, kind: 'hackathon', schedule: [] };
  await main.publish(makeStoreChange('hackathonPlan', null, plan));
  await main.publish(makeStoreChange('trackerMode', 'standard', 'hackathon'));

  assert.deepEqual(panelPlan, plan);
  assert.equal(panelMode, 'hackathon');
  main.close();
  panel.close();
});

test('a late-created desktop client hydrates the persisted Rust snapshot, not legacy storage', async () => {
  const persisted = {
    schemaVersion: 1,
    revision: 7,
    migratedLocalStorage: true,
    done: { persisted: true },
    pushed: { moved: '2026-08-02' },
    pendingDone: {},
    pendingPushed: {},
  };
  const harness = canonicalTauriHarness(persisted);
  const client = createTrackerStateClient({
    runtime: { __TAURI_INTERNALS__: {} },
    loadTauriCore: async () => harness.core,
    loadTauriEvents: async () => harness.events,
  });
  const hydrated = await client.start({ legacyDone: { stale: true }, legacyPushed: {} });
  assert.deepEqual(hydrated.done, { persisted: true });
  assert.equal(hydrated.revision, 7);
  client.close();
});

test('desktop client retries a rejected stale revision and preserves the simultaneous update', async () => {
  const harness = canonicalTauriHarness({
    schemaVersion: 1,
    revision: 1,
    migratedLocalStorage: true,
    done: {},
    pushed: {},
    pendingDone: {},
    pendingPushed: {},
  }, { staleFirstApply: true });
  const client = createTrackerStateClient({
    runtime: { __TAURI_INTERNALS__: {} },
    loadTauriCore: async () => harness.core,
    loadTauriEvents: async () => harness.events,
  });
  await client.start();
  const result = await client.applyPatch({ done: { mine: true } });
  assert.deepEqual(result.done, { other: true, mine: true });
  assert.equal(harness.applyCalls, 2);
  client.close();
});
