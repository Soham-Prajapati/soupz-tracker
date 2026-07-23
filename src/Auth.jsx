import React, { useState, useEffect } from 'react';
import * as Sync from './sync.js';
import { InkDefs, Bowl } from './soup.jsx';

/* AuthGate wraps the whole app.
   - Supabase not configured  → local-only mode, render the app straight away
     (no sign-in, progress lives in localStorage — the current behaviour).
   - Supabase configured       → require sign-in; per-user cloud sync switches on.
   Hooks are always called in the same order (configured is constant per session),
   so the conditional branches below are safe. */
export function AuthGate({ children }) {
  const configured = Sync.isConfigured();
  const [user, setUser] = useState(configured ? undefined : 'local'); // undefined = loading

  useEffect(() => {
    if (!configured) return;
    const sub = Sync.onAuthChange(setUser);
    return () => sub?.unsubscribe?.();
  }, [configured]);

  if (!configured) return children;
  if (user === undefined) return <Splash />;
  if (!user) return <SignIn />;
  return children;
}

function Splash() {
  return (
    <div className="app auth-wrap">
      <InkDefs />
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <Bowl pct={0.4} size={92} heat />
        <div className="lede" style={{ marginTop: 14 }}>Warming up…</div>
      </div>
    </div>
  );
}

function SignIn() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  const google = async () => {
    setBusy('google'); setErr('');
    const { error } = await Sync.signInWithGoogle();
    if (error) { setErr(error.message || 'Could not start Google sign-in.'); setBusy(''); }
    // on success the browser redirects to Google, so no further UI needed here
  };

  const magic = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy('email'); setErr('');
    const { error } = await Sync.signInWithMagicLink(email.trim());
    setBusy('');
    if (error) setErr(error.message || 'Could not send the link.');
    else setSent(true);
  };

  return (
    <div className="app auth-wrap">
      <InkDefs />
      <div className="auth-card">
        <div className="auth-mark">
          <Bowl pct={0.62} size={80} heat garnish={[{ kind: 'leaf', c: 'var(--lld)' }]} />
          <div>
            <div className="auth-name">Soup<i>z</i></div>
            <div className="auth-tag">Your study plan, maintained.</div>
          </div>
        </div>

        {sent ? (
          <div className="auth-sent">
            <div className="auth-h">Check your email</div>
            <p className="lede">
              We sent a sign-in link to <b>{email}</b>. Open it on this device and you are in —
              no password to remember.
            </p>
            <button className="btn" onClick={() => { setSent(false); setEmail(''); }}>Use a different email</button>
          </div>
        ) : (
          <>
            <button className="btn go auth-google" onClick={google} disabled={busy === 'google'}>
              {busy === 'google' ? 'Opening Google…' : 'Continue with Google'}
            </button>

            <div className="auth-or"><span>or</span></div>

            <form onSubmit={magic} className="auth-form">
              <input
                type="email" inputMode="email" autoComplete="email" required
                placeholder="you@college.edu" value={email}
                onChange={(e) => setEmail(e.target.value)} className="auth-input"
              />
              <button className="btn" type="submit" disabled={busy === 'email' || !email.trim()}>
                {busy === 'email' ? 'Sending…' : 'Email me a sign-in link'}
              </button>
            </form>

            {err && <div className="auth-err">{err}</div>}
            <p className="auth-fine">
              No password. Your progress syncs privately to your account; nothing is shared with anyone else.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/* Shown in Settings → Sync when signed in, so there is always a way out. */
export function AccountBadge() {
  const configured = Sync.isConfigured();
  const [user, setUser] = useState(null);
  useEffect(() => { if (configured) Sync.getUser().then(setUser); }, [configured]);
  if (!configured) return null;

  return (
    <div className="sw-row" style={{ marginTop: 10 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 14 }}>Signed in</div>
        <div className="lede" style={{ marginTop: 3, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user?.email || user?.user_metadata?.email || 'your account'}
        </div>
      </div>
      <button className="btn" onClick={() => Sync.signOut()}>Sign out</button>
    </div>
  );
}
