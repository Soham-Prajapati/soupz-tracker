// STAGED for the auth-gate step — NOT yet imported anywhere.
// Multi-user Supabase sync. Per-user isolation is enforced by RLS
// (policy: auth.uid() = user_id), so selects need no manual user_id filter.
// The user's AI provider API key is NEVER handled here — it lives in localStorage.
// Requires: npm i @supabase/supabase-js, and VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
// pointing at the NEW multi-user Supabase project.
import { createClient } from '@supabase/supabase-js';

const SB_URL = import.meta.env.VITE_SUPABASE_URL;
const SB_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SB_URL, SB_ANON, {
  auth: {
    persistSession: true,       // keep the session in localStorage across reloads
    autoRefreshToken: true,
    detectSessionInUrl: true,   // required to complete OAuth / magic-link redirects
  },
});

// ── auth helpers ───────────────────────────────────────────────────────────
export function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
}

export function signInWithMagicLink(email) {
  return supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
}

export function signOut() {
  return supabase.auth.signOut();
}

// Fires immediately with the current user, then on every auth change.
// Returns the subscription — call sub.unsubscribe() to clean up.
export function onAuthChange(cb) {
  supabase.auth.getSession().then(({ data }) => cb(data.session?.user ?? null));
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    cb(session?.user ?? null);
  });
  return data.subscription;
}

export async function getUser() {
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
  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session) return { done: {}, pushed: {}, opportunities: [] };

  // No user_id filter needed: RLS only returns this user's rows.
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
  const user_id = await requireUserId();
  const { error } = await supabase
    .from('progress')
    .upsert({ user_id, id, done, updated_at: new Date().toISOString() },
            { onConflict: 'user_id,id' });
  if (error) throw error;
}

export async function setPushed(id, toDate) {
  const user_id = await requireUserId();
  const { error } = await supabase
    .from('pushed')
    .upsert({ user_id, id, to_date: toDate, updated_at: new Date().toISOString() },
            { onConflict: 'user_id,id' });
  if (error) throw error;
}

// One-time migration of whatever is already in localStorage into the signed-in
// user's rows. user_id is passed explicitly to form the on-conflict target.
export async function pushLocal(done, pushed) {
  const user_id = await requireUserId();

  const progressRows = Object.entries(done)
    .filter(([, v]) => v)
    .map(([id]) => ({ user_id, id, done: true }));
  if (progressRows.length) {
    const { error } = await supabase
      .from('progress').upsert(progressRows, { onConflict: 'user_id,id' });
    if (error) throw error;
  }

  const pushedRows = Object.entries(pushed)
    .map(([id, to_date]) => ({ user_id, id, to_date }));
  if (pushedRows.length) {
    const { error } = await supabase
      .from('pushed').upsert(pushedRows, { onConflict: 'user_id,id' });
    if (error) throw error;
  }
}
