use serde_json::{json, Map, Value};
use std::{
    fs::{self, OpenOptions},
    io::{self, Write},
    os::unix::fs::OpenOptionsExt,
    path::PathBuf,
    sync::Mutex,
    thread,
    time::{Duration, SystemTime},
};

struct ExternalLock(PathBuf);

impl Drop for ExternalLock {
    fn drop(&mut self) { let _ = fs::remove_file(&self.0); }
}

pub struct EngineStateStore {
    path: PathBuf,
    lock: Mutex<()>,
}

impl EngineStateStore {
    pub fn new(path: PathBuf) -> Self {
        Self { path, lock: Mutex::new(()) }
    }

    pub fn plans(&self) -> io::Result<Vec<Value>> {
        let _guard = self.lock.lock().expect("engine state lock poisoned");
        let state = self.read()?;
        Ok(state["plans"].as_object().map(|plans| plans.values().cloned().collect()).unwrap_or_default())
    }

    pub fn upsert_plan(&self, plan: Value) -> io::Result<()> {
        let id = plan.get("id").and_then(Value::as_str)
            .filter(|id| !id.is_empty())
            .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "plan.id is required"))?
            .to_owned();
        let _guard = self.lock.lock().expect("engine state lock poisoned");
        let _external = self.acquire_external_lock()?;
        let mut state = self.read()?;
        state["plans"].as_object_mut().expect("plans initialized").insert(id.clone(), plan);
        state["progress"].as_object_mut().expect("progress initialized")
            .entry(id.clone()).or_insert_with(|| json!({ "schemaVersion": 1, "planId": id, "entries": {} }));
        self.write(&state)
    }

    pub fn remove_plan(&self, plan_id: &str) -> io::Result<()> {
        let _guard = self.lock.lock().expect("engine state lock poisoned");
        let _external = self.acquire_external_lock()?;
        let mut state = self.read()?;
        state["plans"].as_object_mut().expect("plans initialized").remove(plan_id);
        self.write(&state)
    }

    fn read(&self) -> io::Result<Value> {
        let mut state = match fs::read(&self.path) {
            Ok(bytes) => serde_json::from_slice::<Value>(&bytes)
                .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?,
            Err(error) if error.kind() == io::ErrorKind::NotFound => json!({ "schemaVersion": 1, "plans": {}, "progress": {} }),
            Err(error) => return Err(error),
        };
        if state.get("schemaVersion").and_then(Value::as_u64) != Some(1) {
            return Err(io::Error::new(io::ErrorKind::InvalidData, "unsupported engine state schema"));
        }
        if !state.get("plans").is_some_and(Value::is_object) { state["plans"] = Value::Object(Map::new()); }
        if !state.get("progress").is_some_and(Value::is_object) { state["progress"] = Value::Object(Map::new()); }
        Ok(state)
    }

    fn acquire_external_lock(&self) -> io::Result<ExternalLock> {
        let lock_path = PathBuf::from(format!("{}.lock", self.path.display()));
        if let Some(parent) = lock_path.parent() { fs::create_dir_all(parent)?; }
        for _ in 0..250 {
            match OpenOptions::new().create_new(true).write(true).mode(0o600).open(&lock_path) {
                Ok(_) => return Ok(ExternalLock(lock_path)),
                Err(error) if error.kind() == io::ErrorKind::AlreadyExists => {
                    let stale = fs::metadata(&lock_path).and_then(|meta| meta.modified())
                        .ok().and_then(|modified| SystemTime::now().duration_since(modified).ok())
                        .is_some_and(|age| age > Duration::from_secs(30));
                    if stale { let _ = fs::remove_file(&lock_path); }
                    else { thread::sleep(Duration::from_millis(20)); }
                }
                Err(error) => return Err(error),
            }
        }
        Err(io::Error::new(io::ErrorKind::TimedOut, "timed out waiting for engine state lock"))
    }

    fn write(&self, state: &Value) -> io::Result<()> {
        if let Some(parent) = self.path.parent() { fs::create_dir_all(parent)?; }
        let temporary = self.path.with_extension("json.tmp");
        let bytes = serde_json::to_vec_pretty(state)
            .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;
        let mut file = OpenOptions::new().create(true).truncate(true).write(true).mode(0o600).open(&temporary)?;
        file.write_all(&bytes)?;
        file.write_all(b"\n")?;
        file.sync_all()?;
        fs::rename(temporary, &self.path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::os::unix::fs::PermissionsExt;

    #[test]
    fn shares_plan_documents_with_private_file_permissions() {
        let path = std::env::temp_dir().join(format!("soupz-engine-{}.json", std::process::id()));
        let store = EngineStateStore::new(path.clone());
        store.upsert_plan(json!({ "id": "pln_test", "title": "Read" })).unwrap();
        assert_eq!(store.plans().unwrap()[0]["id"], "pln_test");
        assert_eq!(fs::metadata(&path).unwrap().permissions().mode() & 0o777, 0o600);
        let _ = fs::remove_file(path);
    }
}
