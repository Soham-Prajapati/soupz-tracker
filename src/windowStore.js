// One live-state transport per runtime:
//   Tauri webviews -> Tauri's process-wide event bus
//   browser tabs   -> BroadcastChannel (or the storage event as a fallback)
// localStorage remains the durable source so existing task ids and data keep
// their current shape. Messages for map stores contain only changed keys; two
// windows ticking different tasks cannot overwrite one another with stale maps.

export const STORE_EVENT = 'store://changed';
export const TRACKER_STATE_EVENT = 'tracker://state-changed';
const PATCH_STORES = new Set(['done', 'pushed']);

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export function makeStoreChange(key, previous, next, source = '') {
  if (!PATCH_STORES.has(key) || !isObject(previous) || !isObject(next)) {
    return { key, value: next, patch: false, source };
  }

  const value = {};
  for (const [id, state] of Object.entries(next)) {
    if (!Object.is(previous[id], state)) value[id] = state;
  }
  const removed = Object.keys(previous).filter(id => !(id in next));
  return { key, value, removed, patch: true, source };
}

export function applyStoreChange(current, change) {
  if (!change?.patch || !isObject(current) || !isObject(change.value)) return change?.value;
  const next = { ...current, ...change.value };
  for (const id of change.removed || []) delete next[id];
  return next;
}

function validChange(change) {
  return isObject(change) && typeof change.key === 'string' && 'value' in change;
}

function makeSourceId() {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

export function createWindowStoreSync({
  runtime = typeof window === 'undefined' ? null : window,
  loadTauriEvents = () => import('@tauri-apps/api/event'),
  source = makeSourceId(),
} = {}) {
  const subscribers = new Set();
  const isTauri = Boolean(runtime && '__TAURI_INTERNALS__' in runtime);
  let channel = null;
  let removeRuntimeListener = () => {};
  let removeTauriListener = () => {};
  let closed = false;

  const receive = (change) => {
    if (!validChange(change) || change.source === source) return;
    subscribers.forEach(listener => listener(change));
  };

  let ready = Promise.resolve();
  let tauriEvents = null;

  if (isTauri) {
    tauriEvents = Promise.resolve().then(loadTauriEvents);
    ready = tauriEvents
      .then(api => api.listen(STORE_EVENT, event => receive(event.payload)))
      .then(unlisten => {
        if (closed) unlisten();
        else removeTauriListener = unlisten;
      });
  } else if (runtime?.BroadcastChannel) {
    channel = new runtime.BroadcastChannel(STORE_EVENT);
    channel.onmessage = event => receive(event.data);
  } else if (runtime?.addEventListener) {
    const onStorage = (event) => {
      if (!event.key || event.newValue === null) return;
      try {
        // The storage event is only a last-resort transport. It already carries
        // the complete persisted value, so it is applied as a replacement.
        receive({ key: event.key, value: JSON.parse(event.newValue), patch: false, source: 'storage' });
      } catch {}
    };
    runtime.addEventListener('storage', onStorage);
    removeRuntimeListener = () => runtime.removeEventListener('storage', onStorage);
  }

  return {
    ready,
    subscribe(listener) {
      subscribers.add(listener);
      return () => subscribers.delete(listener);
    },
    publish(change) {
      const message = { ...change, source };
      if (isTauri) {
        // Loading is cached above, so normal post-mount publishes go straight
        // onto the native event bus. A startup publish queues behind the import.
        return tauriEvents.then(api => api.emit(STORE_EVENT, message)).catch(() => {});
      }
      channel?.postMessage(message);
      return Promise.resolve();
    },
    close() {
      closed = true;
      subscribers.clear();
      removeRuntimeListener();
      removeTauriListener();
      channel?.close();
    },
  };
}

export const windowStoreSync = createWindowStoreSync();

export const EMPTY_TRACKER_STATE = Object.freeze({
  schemaVersion: 1,
  revision: 0,
  migratedLocalStorage: false,
  done: Object.freeze({}),
  pushed: Object.freeze({}),
  pendingDone: Object.freeze({}),
  pendingPushed: Object.freeze({}),
});

function validTrackerState(value) {
  return isObject(value)
    && Number.isSafeInteger(value.revision)
    && isObject(value.done)
    && isObject(value.pushed)
    && isObject(value.pendingDone)
    && isObject(value.pendingPushed);
}

// Desktop progress has one owner: the persisted Rust store. Every webview
// subscribes before hydrating, applies only newer revisions, and retries a
// rejected stale write against the snapshot returned by Rust.
export function createTrackerStateClient({
  runtime = typeof window === 'undefined' ? null : window,
  loadTauriCore = () => import('@tauri-apps/api/core'),
  loadTauriEvents = () => import('@tauri-apps/api/event'),
} = {}) {
  const subscribers = new Set();
  const isTauri = Boolean(runtime && '__TAURI_INTERNALS__' in runtime);
  let snapshot = EMPTY_TRACKER_STATE;
  let unlisten = () => {};
  let startPromise = null;
  let closed = false;

  const accept = (next) => {
    if (!validTrackerState(next) || next.revision < snapshot.revision) return snapshot;
    if (next === snapshot) return snapshot;
    snapshot = next;
    subscribers.forEach(listener => listener(snapshot));
    return snapshot;
  };

  const invokeCommand = async (command, args = {}) => {
    if (!isTauri) throw new Error(`${command} requires the Soupz Tracker desktop runtime`);
    const { invoke } = await loadTauriCore();
    return invoke(command, args);
  };

  const start = ({ legacyDone = {}, legacyPushed = {} } = {}) => {
    if (startPromise) return startPromise;
    startPromise = (async () => {
      if (!isTauri) return snapshot;
      const { listen } = await loadTauriEvents();
      const remove = await listen(TRACKER_STATE_EVENT, event => accept(event.payload));
      if (closed) {
        remove();
        return snapshot;
      }
      unlisten = remove;
      const result = await invokeCommand('migrate_tracker_state', { legacyDone, legacyPushed });
      return accept(result.state);
    })();
    return startPromise;
  };

  const applyPatch = async ({ done = {}, pushed = {} }) => {
    await start();
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const result = await invokeCommand('apply_tracker_patch', {
        expectedRevision: snapshot.revision,
        done,
        pushed,
      });
      accept(result.state);
      if (result.applied && !result.stale) return snapshot;
    }
    throw new Error('Tracker state changed too quickly; retry the action');
  };

  const mergeRemote = async ({ done = {}, pushed = {}, complete = true }) => {
    await start();
    const result = await invokeCommand('merge_tracker_remote', { done, pushed, complete });
    return accept(result.state);
  };

  const acknowledgeSync = async ({ done = {}, pushed = {} }) => {
    await start();
    const result = await invokeCommand('acknowledge_tracker_sync', { done, pushed });
    return accept(result.state);
  };

  return {
    isTauri,
    start,
    applyPatch,
    mergeRemote,
    acknowledgeSync,
    getSnapshot: () => snapshot,
    subscribe(listener) {
      subscribers.add(listener);
      return () => subscribers.delete(listener);
    },
    close() {
      closed = true;
      unlisten();
      subscribers.clear();
    },
  };
}

export const trackerStateClient = createTrackerStateClient();
