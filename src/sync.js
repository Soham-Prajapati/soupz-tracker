// Multi-user Supabase sync, auth-aware, with a graceful local-only fallback.
//
// If VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set, the app runs in
// LOCAL-ONLY mode: no auth, progress lives in localStorage (handled in App via
// useStore), and every function here is a safe no-op. The moment those env vars
// point at the multi-user Supabase project, auth + per-user cloud sync switch on.
//
// Per-user isolation is enforced by RLS (policy: auth.uid() = user_id), so reads
// need no manual user_id filter. AI-provider keys are never handled here; the
// optional extractor keeps its one-use key only in component memory.
import { createClient } from '@supabase/supabase-js';
import { emailOtpVerification, emailSignInOptions, isNativeRuntime } from './authFlow.js';

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

export function sendEmailSignIn(email) {
  if (!configured) return Promise.resolve({ error: null });
  const native = isNativeRuntime();
  return supabase.auth.signInWithOtp({
    email,
    options: emailSignInOptions({
      native,
      webOrigin: native ? undefined : window.location.origin,
    }),
  });
}

export function verifyEmailOtp(email, token) {
  if (!configured) return Promise.resolve({ data: null, error: null });
  return supabase.auth.verifyOtp(emailOtpVerification(email, token));
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
    done: Object.fromEntries(progress.data.map(r => [r.id, r.done])),
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

  const progressRows = Object.entries(done).map(([id, value]) => ({ user_id, id, done: Boolean(value) }));
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

// Flushes the Rust store's durable outbox. Returning false means there is no
// signed-in cloud destination yet; callers must retain the pending rows.
export async function pushPending(done, pushed) {
  if (!configured) return false;
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return false;
  const user_id = sessionData.session.user.id;
  const updated_at = new Date().toISOString();

  const progressRows = Object.entries(done).map(([id, value]) => ({
    user_id,
    id,
    done: Boolean(value),
    updated_at,
  }));
  if (progressRows.length) {
    const { error } = await supabase.from('progress')
      .upsert(progressRows, { onConflict: 'user_id,id' });
    if (error) throw error;
  }

  const pushedRows = Object.entries(pushed).map(([id, to_date]) => ({
    user_id,
    id,
    to_date,
    updated_at,
  }));
  if (pushedRows.length) {
    const { error } = await supabase.from('pushed')
      .upsert(pushedRows, { onConflict: 'user_id,id' });
    if (error) throw error;
  }
  return true;
}

// Supabase is a convergence transport, never desktop authority. Realtime rows
// are merged by the Rust store, which preserves any local value still pending.
export async function subscribeTrackerState(onChange) {
  if (!configured) return () => {};
  const user = await getUser();
  if (!user) return () => {};
  const filter = `user_id=eq.${user.id}`;
  const channel = supabase
    .channel(`tracker-state-${user.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'progress', filter }, payload => {
      const row = payload.new;
      if (row?.id && typeof row.done === 'boolean') onChange({ done: { [row.id]: row.done } });
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pushed', filter }, payload => {
      const row = payload.new;
      if (row?.id && row.to_date) onChange({ pushed: { [row.id]: row.to_date } });
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
