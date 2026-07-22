// Supabase sync. Progress is shared across laptop, phone and the Mac app.
// Anon key is public by design — RLS allows read/write on these three tables only,
// and there is nothing private in a list of solved LeetCode problems.
const SB_URL = 'https://REDACTED_SUPABASE_REF.supabase.co';
const KEY = 'REDACTED_SUPABASE_ANON_KEY';
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function req(path, opts = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { ...opts, headers: { ...H, ...(opts.headers||{}) } });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}

export async function pullAll() {
  const [progress, pushed, opps] = await Promise.all([
    req('progress?select=id,done'),
    req('pushed?select=id,to_date'),
    req('opportunities?select=*&order=due_date.asc'),
  ]);
  return {
    done: Object.fromEntries(progress.filter(r => r.done).map(r => [r.id, true])),
    pushed: Object.fromEntries(pushed.map(r => [r.id, r.to_date])),
    opportunities: opps,
  };
}

export function setDone(id, done) {
  return req('progress', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ id, done, updated_at: new Date().toISOString() }),
  });
}

export function setPushed(id, toDate) {
  return req('pushed', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ id, to_date: toDate, updated_at: new Date().toISOString() }),
  });
}

// One-time migration of whatever is already in localStorage.
export async function pushLocal(done, pushed) {
  const rows = Object.entries(done).filter(([, v]) => v).map(([id]) => ({ id, done: true }));
  if (rows.length) await req('progress', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(rows) });
  const p = Object.entries(pushed).map(([id, to_date]) => ({ id, to_date }));
  if (p.length) await req('pushed', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(p) });
}
