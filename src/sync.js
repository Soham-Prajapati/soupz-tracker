// Multi-user Supabase sync, auth-aware, with a graceful local-only fallback.
//
// If VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set, the app runs in
// LOCAL-ONLY mode: no auth, progress lives in localStorage (handled in App via
// useStore), and every function here is a safe no-op. The moment those env vars
// point at the multi-user Supabase project, auth + per-user cloud sync switch on.
//
// Per-user isolation is enforced by RLS (policy: auth.uid() = user_id), so reads
// need no manual user_id filter. The user's AI provider API key is NEVER handled
// here — it lives in localStorage only.
import { createClient } from '@supabase/supabase-js';

const SB_URL = import.meta.env.VITE_SUPABASE_URL;
const SB_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;
const configured = Boolean(SB_URL && SB_ANON);

export const isConfigured = () => configured;

export const supabase = configured
  ? createClient(SB_URL, SB_ANON, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

// ── auth helpers (no-op in local-only mode) ────────────────────────────────
export function signInWithGoogle() {
  if (!configured) return Promise.resolve({ error: null });
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
}

export function signInWithMagicLink(email) {
  if (!configured) return Promise.resolve({ error: null });
  return supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
}

export function signOut() {
  if (!configured) return Promise.resolve({ error: null });
  return supabase.auth.signOut();
}

// Fires immediately with the current user, then on every auth change.
// Returns a subscription-like object with unsubscribe().
export function onAuthChange(cb) {
  if (!configured) { cb(null); return { unsubscribe() {} }; }
  supabase.auth.getSession().then(({ data }) => cb(data.session?.user ?? null));
  const { data } = supabase.auth.onAuthStateChange((_e, session) => cb(session?.user ?? null));
  return data.subscription;
}

export async function getUser() {
  if (!configured) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

async function requireUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Not signed in');
  return data.user.id;
}

// ── data reads/writes (RLS scopes every row to the signed-in user) ──────────
export async function pullAll() {
  if (!configured) return { done: {}, pushed: {}, opportunities: [] };
  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session) return { done: {}, pushed: {}, opportunities: [] };

  const [progress, pushed, opps] = await Promise.all([
    supabase.from('progress').select('id,done'),
    supabase.from('pushed').select('id,to_date'),
    supabase.from('opportunities').select('*').order('due_date', { ascending: true }),
  ]);
  for (const r of [progress, pushed, opps]) if (r.error) throw r.error;

  return {
    done: Object.fromEntries(progress.data.filter(r => r.done).map(r => [r.id, true])),
    pushed: Object.fromEntries(pushed.data.map(r => [r.id, r.to_date])),
    opportunities: opps.data,
  };
}

export async function setDone(id, done) {
  if (!configured) return;
  const user_id = await requireUserId();
  const { error } = await supabase
    .from('progress')
    .upsert({ user_id, id, done, updated_at: new Date().toISOString() }, { onConflict: 'user_id,id' });
  if (error) throw error;
}

export async function setPushed(id, toDate) {
  if (!configured) return;
  const user_id = await requireUserId();
  const { error } = await supabase
    .from('pushed')
    .upsert({ user_id, id, to_date: toDate, updated_at: new Date().toISOString() }, { onConflict: 'user_id,id' });
  if (error) throw error;
}

// One-time migration of whatever is already in localStorage into the signed-in
// user's rows. user_id is passed explicitly to form the on-conflict target.
export async function pushLocal(done, pushed) {
  if (!configured) return;
  const user_id = await requireUserId();

  const progressRows = Object.entries(done).filter(([, v]) => v).map(([id]) => ({ user_id, id, done: true }));
  if (progressRows.length) {
    const { error } = await supabase.from('progress').upsert(progressRows, { onConflict: 'user_id,id' });
    if (error) throw error;
  }
  const pushedRows = Object.entries(pushed).map(([id, to_date]) => ({ user_id, id, to_date }));
  if (pushedRows.length) {
    const { error } = await supabase.from('pushed').upsert(pushedRows, { onConflict: 'user_id,id' });
    if (error) throw error;
  }
}
