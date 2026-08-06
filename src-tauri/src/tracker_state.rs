use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    fs,
    io::{self, Write},
    os::unix::fs::OpenOptionsExt,
    path::{Path, PathBuf},
    sync::Mutex,
};

pub const TRACKER_STATE_EVENT: &str = "tracker://state-changed";
const SCHEMA_VERSION: u32 = 1;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TrackerState {
    pub schema_version: u32,
    pub revision: u64,
    pub migrated_local_storage: bool,
    pub done: BTreeMap<String, bool>,
    pub pushed: BTreeMap<String, String>,
    pub pending_done: BTreeMap<String, bool>,
    pub pending_pushed: BTreeMap<String, String>,
}

impl Default for TrackerState {
    fn default() -> Self {
        Self {
            schema_version: SCHEMA_VERSION,
            revision: 0,
            migrated_local_storage: false,
            done: BTreeMap::new(),
            pushed: BTreeMap::new(),
            pending_done: BTreeMap::new(),
            pending_pushed: BTreeMap::new(),
        }
    }
}

#[derive(Clone, Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TrackerPatch {
    #[serde(default)]
    pub done: BTreeMap<String, bool>,
    #[serde(default)]
    pub pushed: BTreeMap<String, String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MutationResult {
    pub applied: bool,
    pub stale: bool,
    pub committed: bool,
    pub state: TrackerState,
}

pub struct TrackerStateStore {
    path: PathBuf,
    state: Mutex<TrackerState>,
}

impl TrackerStateStore {
    pub fn open(path: PathBuf) -> io::Result<Self> {
        let state = match fs::read(&path) {
            Ok(bytes) => serde_json::from_slice::<TrackerState>(&bytes)
                .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?,
            Err(error) if error.kind() == io::ErrorKind::NotFound => TrackerState::default(),
            Err(error) => return Err(error),
        };
        if state.schema_version != SCHEMA_VERSION {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                format!("unsupported tracker state schema {}", state.schema_version),
            ));
        }
        Ok(Self {
            path,
            state: Mutex::new(state),
        })
    }

    pub fn snapshot(&self) -> TrackerState {
        self.state.lock().expect("tracker state lock poisoned").clone()
    }

    pub fn migrate(
        &self,
        legacy_done: BTreeMap<String, bool>,
        legacy_pushed: BTreeMap<String, String>,
    ) -> io::Result<MutationResult> {
        self.mutate(None, |state| {
            if state.migrated_local_storage {
                return false;
            }
            for (id, value) in legacy_done {
                state.done.insert(id.clone(), value);
                state.pending_done.insert(id, value);
            }
            for (id, value) in legacy_pushed {
                state.pushed.insert(id.clone(), value.clone());
                state.pending_pushed.insert(id, value);
            }
            state.migrated_local_storage = true;
            true
        })
    }

    pub fn apply(&self, expected_revision: u64, patch: TrackerPatch) -> io::Result<MutationResult> {
        self.mutate(Some(expected_revision), |state| {
            let mut changed = false;
            for (id, value) in patch.done {
                if state.done.get(&id) != Some(&value) {
                    state.done.insert(id.clone(), value);
                    changed = true;
                }
                if state.pending_done.get(&id) != Some(&value) {
                    state.pending_done.insert(id, value);
                    changed = true;
                }
            }
            for (id, value) in patch.pushed {
                if state.pushed.get(&id) != Some(&value) {
                    state.pushed.insert(id.clone(), value.clone());
                    changed = true;
                }
                if state.pending_pushed.get(&id) != Some(&value) {
                    state.pending_pushed.insert(id, value);
                    changed = true;
                }
            }
            changed
        })
    }

    pub fn replace_for_account(&self, snapshot: TrackerPatch) -> io::Result<MutationResult> {
        self.mutate(None, |state| {
            let changed = state.done != snapshot.done || state.pushed != snapshot.pushed
                || !state.pending_done.is_empty() || !state.pending_pushed.is_empty();
            state.done = snapshot.done;
            state.pushed = snapshot.pushed;
            state.pending_done.clear();
            state.pending_pushed.clear();
            state.migrated_local_storage = true;
            changed
        })
    }

    pub fn merge_remote(&self, remote: TrackerPatch, complete: bool) -> io::Result<MutationResult> {
        self.mutate(None, |state| {
            let mut changed = false;

            for (id, value) in &remote.done {
                if !state.pending_done.contains_key(id) && state.done.get(id) != Some(value) {
                    state.done.insert(id.clone(), *value);
                    changed = true;
                }
            }
            for (id, value) in &remote.pushed {
                if !state.pending_pushed.contains_key(id) && state.pushed.get(id) != Some(value) {
                    state.pushed.insert(id.clone(), value.clone());
                    changed = true;
                }
            }

            if complete {
                // Rows absent in a complete remote snapshot are local work that
                // still needs an upload. Realtime events are partial and skip this.
                for (id, value) in &state.done {
                    if !remote.done.contains_key(id) && !state.pending_done.contains_key(id) {
                        state.pending_done.insert(id.clone(), *value);
                        changed = true;
                    }
                }
                for (id, value) in &state.pushed {
                    if !remote.pushed.contains_key(id) && !state.pending_pushed.contains_key(id) {
                        state.pending_pushed.insert(id.clone(), value.clone());
                        changed = true;
                    }
                }
            }
            changed
        })
    }

    pub fn acknowledge(&self, synced: TrackerPatch) -> io::Result<MutationResult> {
        self.mutate(None, |state| {
            let mut changed = false;
            for (id, value) in synced.done {
                if state.pending_done.get(&id) == Some(&value) {
                    state.pending_done.remove(&id);
                    changed = true;
                }
            }
            for (id, value) in synced.pushed {
                if state.pending_pushed.get(&id) == Some(&value) {
                    state.pending_pushed.remove(&id);
                    changed = true;
                }
            }
            changed
        })
    }

    fn mutate<F>(&self, expected_revision: Option<u64>, edit: F) -> io::Result<MutationResult>
    where
        F: FnOnce(&mut TrackerState) -> bool,
    {
        let mut guard = self.state.lock().expect("tracker state lock poisoned");
        if expected_revision.is_some_and(|revision| revision != guard.revision) {
            return Ok(MutationResult {
                applied: false,
                stale: true,
                committed: false,
                state: guard.clone(),
            });
        }

        let before = guard.clone();
        let changed = edit(&mut guard);
        if !changed {
            return Ok(MutationResult {
                applied: true,
                stale: false,
                committed: false,
                state: guard.clone(),
            });
        }

        guard.revision = guard.revision.saturating_add(1);
        if let Err(error) = persist_atomically(&self.path, &guard) {
            *guard = before;
            return Err(error);
        }
        Ok(MutationResult {
            applied: true,
            stale: false,
            committed: true,
            state: guard.clone(),
        })
    }
}

fn persist_atomically(path: &Path, state: &TrackerState) -> io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let temporary = path.with_extension("json.tmp");
    let bytes = serde_json::to_vec_pretty(state)
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;
    {
        let mut file = fs::OpenOptions::new()
            .create(true)
            .truncate(true)
            .write(true)
            .mode(0o600)
            .open(&temporary)?;
        file.write_all(&bytes)?;
        file.sync_all()?;
    }
    fs::rename(temporary, path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        sync::{Arc, Barrier},
        thread,
        time::{SystemTime, UNIX_EPOCH},
    };

    fn test_path(name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("soupz-tracker-{name}-{unique}.json"))
    }

    fn map<T>(key: &str, value: T) -> BTreeMap<String, T> {
        BTreeMap::from([(key.to_owned(), value)])
    }

    #[test]
    fn migrates_local_storage_exactly_once() {
        let path = test_path("migration");
        let store = TrackerStateStore::open(path.clone()).unwrap();
        let first = store
            .migrate(map("legacy", true), map("move", "2026-08-01".to_owned()))
            .unwrap();
        assert!(first.applied);
        assert_eq!(first.state.done.get("legacy"), Some(&true));

        let second = store
            .migrate(map("late", true), map("late", "2026-09-01".to_owned()))
            .unwrap();
        assert!(!second.state.done.contains_key("late"));
        let _ = fs::remove_file(path);
    }

    #[test]
    fn late_created_panel_hydrates_the_latest_committed_snapshot() {
        let path = test_path("late-panel");
        let store = TrackerStateStore::open(path.clone()).unwrap();
        let migrated = store.migrate(BTreeMap::new(), BTreeMap::new()).unwrap();
        store
            .apply(
                migrated.state.revision,
                TrackerPatch { done: map("task", true), ..Default::default() },
            )
            .unwrap();
        assert_eq!(store.snapshot().done.get("task"), Some(&true));
        let _ = fs::remove_file(path);
    }

    #[test]
    fn restart_loads_the_last_atomic_revision() {
        let path = test_path("restart");
        let store = TrackerStateStore::open(path.clone()).unwrap();
        let migrated = store.migrate(BTreeMap::new(), BTreeMap::new()).unwrap();
        let written = store
            .apply(
                migrated.state.revision,
                TrackerPatch { pushed: map("task", "2026-08-02".to_owned()), ..Default::default() },
            )
            .unwrap();
        drop(store);

        let reopened = TrackerStateStore::open(path.clone()).unwrap();
        assert_eq!(reopened.snapshot(), written.state);
        let _ = fs::remove_file(path);
    }

    #[test]
    fn stale_revision_is_rejected_without_overwriting() {
        let path = test_path("stale");
        let store = TrackerStateStore::open(path.clone()).unwrap();
        let migrated = store.migrate(BTreeMap::new(), BTreeMap::new()).unwrap();
        let first = store
            .apply(
                migrated.state.revision,
                TrackerPatch { done: map("a", true), ..Default::default() },
            )
            .unwrap();
        let stale = store
            .apply(
                migrated.state.revision,
                TrackerPatch { done: map("b", true), ..Default::default() },
            )
            .unwrap();
        assert!(stale.stale);
        assert_eq!(stale.state, first.state);
        let _ = fs::remove_file(path);
    }

    #[test]
    fn simultaneous_updates_converge_after_the_stale_writer_retries() {
        let path = test_path("simultaneous");
        let store = Arc::new(TrackerStateStore::open(path.clone()).unwrap());
        let revision = store.migrate(BTreeMap::new(), BTreeMap::new()).unwrap().state.revision;
        let barrier = Arc::new(Barrier::new(2));
        let mut handles = Vec::new();
        for id in ["a", "b"] {
            let store = Arc::clone(&store);
            let barrier = Arc::clone(&barrier);
            handles.push(thread::spawn(move || {
                barrier.wait();
                let patch = TrackerPatch { done: map(id, true), ..Default::default() };
                let first = store.apply(revision, patch.clone()).unwrap();
                if first.stale {
                    store.apply(first.state.revision, patch).unwrap()
                } else {
                    first
                }
            }));
        }
        for handle in handles { assert!(handle.join().unwrap().applied); }
        assert_eq!(store.snapshot().done, BTreeMap::from([("a".into(), true), ("b".into(), true)]));
        let _ = fs::remove_file(path);
    }

    #[test]
    fn realtime_remote_patch_does_not_queue_unrelated_rows_for_upload() {
        let path = test_path("remote-partial");
        let store = TrackerStateStore::open(path.clone()).unwrap();
        let migrated = store
            .migrate(map("local", true), BTreeMap::new())
            .unwrap();
        store
            .acknowledge(TrackerPatch {
                done: migrated.state.pending_done,
                ..Default::default()
            })
            .unwrap();

        let merged = store
            .merge_remote(
                TrackerPatch { done: map("remote", true), ..Default::default() },
                false,
            )
            .unwrap();
        assert_eq!(merged.state.done.get("local"), Some(&true));
        assert_eq!(merged.state.done.get("remote"), Some(&true));
        assert!(merged.state.pending_done.is_empty());
        let _ = fs::remove_file(path);
    }
}
