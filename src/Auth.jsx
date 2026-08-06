import React, { useState, useEffect } from 'react';
import * as Sync from './sync.js';
import { InkDefs, Bowl } from './soup.jsx';
import { isCompleteEmailOtp, isNativeRuntime, normalizeEmailOtp } from './authFlow.js';

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
      <div className="auth-card" style={{ textAlign: 'center' }} role="status" aria-live="polite" aria-busy="true">
        <Bowl pct={0.4} size={92} heat />
        <div className="lede" style={{ marginTop: 14 }}>Loading…</div>
      </div>
    </div>
  );
}

// Google is only shown once OAuth is configured (VITE_ENABLE_GOOGLE=true).
// Until then we ship email-only, which needs no Google Cloud setup.
const googleEnabled = import.meta.env.VITE_ENABLE_GOOGLE === 'true';

export function SignIn({ initialSentEmail = '' }) {
  const native = isNativeRuntime();
  const [email, setEmail] = useState('');
  const [sentEmail, setSentEmail] = useState(initialSentEmail);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');

  const google = async () => {
    setBusy('google'); setErr(''); setNotice('');
    try {
      const { error } = await Sync.signInWithGoogle();
      if (error) setErr(error.message || 'Could not start Google sign-in.');
    } catch (error) {
      setErr(error?.message || 'Could not start Google sign-in.');
    } finally {
      setBusy('');
    }
    // on success the browser redirects to Google, so no further UI needed here
  };

  const sendEmail = async (address, { resend = false } = {}) => {
    const cleanEmail = address.trim();
    if (!cleanEmail) return;
    setBusy(resend ? 'resend' : 'email'); setErr(''); setNotice('');
    try {
      const { error } = await Sync.sendEmailSignIn(cleanEmail);
      if (error) {
        setErr(error.message || `Could not send the sign-in ${native ? 'code' : 'link'}.`);
        return;
      }
      setSentEmail(cleanEmail);
      setCode('');
      if (resend) setNotice(`A new ${native ? 'code' : 'link'} was sent.`);
    } catch (error) {
      setErr(error?.message || `Could not send the sign-in ${native ? 'code' : 'link'}.`);
    } finally {
      setBusy('');
    }
  };

  const submitEmail = async (e) => {
    e.preventDefault();
    await sendEmail(email);
  };

  const verifyCode = async (e) => {
    e.preventDefault();
    if (!isCompleteEmailOtp(code)) return;
    setBusy('verify'); setErr(''); setNotice('');
    try {
      const { error } = await Sync.verifyEmailOtp(sentEmail, code);
      if (error) setErr(error.message || 'That code could not be verified. Request a new code and try again.');
      else setNotice('Email verified. Opening your plan…');
    } catch (error) {
      setErr(error?.message || 'That code could not be verified. Request a new code and try again.');
    } finally {
      setBusy('');
    }
  };

  const changeEmail = () => {
    setSentEmail('');
    setCode('');
    setErr('');
    setNotice('');
  };

  return (
    <div className="app auth-wrap">
      <InkDefs />
      <div className="auth-card">
        <div className="auth-mark">
          <Bowl pct={0.62} size={80} heat garnish={[{ kind: 'leaf', c: 'var(--lld)' }]} />
          <div>
            <div className="auth-name">Soupz <i>Tracker</i></div>
            <div className="auth-tag">Your plans, maintained.</div>
          </div>
        </div>

        {sentEmail ? (
          <div className="auth-sent">
            <h1 className="auth-h">{native ? 'Enter verification code' : 'Check your email'}</h1>
            <p className="lede" id="email-code-help">
              {native ? (
                <>
                  We sent a six-digit code to <b>{sentEmail}</b>. Enter it here to finish signing in
                  without leaving Soupz Tracker.
                </>
              ) : (
                <>
                We sent a sign-in link to <b>{sentEmail}</b>. Open it in this browser to finish
                signing in. If the email also shows a six-digit code, you can enter it below.
                </>
              )}
            </p>
            <form onSubmit={verifyCode} className="auth-form" aria-busy={busy === 'verify'}>
              <label className="auth-label" htmlFor="email-code">
                Six-digit code{native ? '' : ' (if shown)'}
              </label>
              <input
                id="email-code" type="text" inputMode="numeric" autoComplete="one-time-code"
                pattern="[0-9]{6}" maxLength={6} required autoFocus={native}
                value={code} onChange={(e) => setCode(normalizeEmailOtp(e.target.value))}
                className="auth-input auth-code" aria-describedby="email-code-help"
                aria-invalid={Boolean(err)}
              />
              <button className="btn go" type="submit"
                disabled={busy === 'verify' || !isCompleteEmailOtp(code)}>
                {busy === 'verify' ? 'Verifying…' : 'Verify and continue'}
              </button>
            </form>
            {err && <div className="auth-err" role="alert">{err}</div>}
            {notice && <div className="auth-notice" role="status" aria-live="polite">{notice}</div>}
            <div className="auth-actions">
              <button className="btn" type="button" onClick={() => sendEmail(sentEmail, { resend: true })}
                disabled={Boolean(busy)}>
                {busy === 'resend' ? 'Sending again…' : native ? 'Send a new code' : 'Send the link again'}
              </button>
              <button className="btn" type="button" onClick={changeEmail} disabled={Boolean(busy)}>
                Use a different email
              </button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="auth-h">Sign in to sync</h1>
            <p className="lede auth-intro">
              Use your email to keep progress available across your devices.
            </p>

            {googleEnabled && !native && (
              <>
                <button className="btn go auth-google" onClick={google} disabled={busy === 'google'}>
                  {busy === 'google' ? 'Opening Google…' : 'Continue with Google'}
                </button>
                <div className="auth-or"><span>or</span></div>
              </>
            )}

            <form onSubmit={submitEmail} className="auth-form" aria-busy={busy === 'email'}>
              <label className="auth-label" htmlFor="sign-in-email">Email address</label>
              <input
                id="sign-in-email" type="email" inputMode="email" autoComplete="email" required
                placeholder="you@example.com" value={email}
                onChange={(e) => setEmail(e.target.value)} className="auth-input"
                aria-invalid={Boolean(err)}
              />
              <button className="btn" type="submit" disabled={busy === 'email' || !email.trim()}>
                {busy === 'email' ? 'Sending…' : `Email me a sign-in ${native ? 'code' : 'link'}`}
              </button>
            </form>

            {err && <div className="auth-err" role="alert">{err}</div>}
            <p className="auth-fine">
              No password. Your account progress is private and is not shared with other users.
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
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!configured) return undefined;
    const subscription = Sync.onAuthChange(setUser);
    return () => subscription.unsubscribe();
  }, [configured]);
  if (!configured) return null;

  if (!user) return (
    <form className="auth-form" onSubmit={async event => {
      event.preventDefault();
      const { error } = await Sync.sendEmailSignIn(email.trim());
      setNotice(error ? error.message : 'Check your email for the sign-in link or code.');
    }}>
      <label className="auth-label">Email for optional sync
        <input className="auth-input" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" required />
      </label>
      <button className="btn" type="submit">Connect sync</button>
      {notice && <span className="auth-notice" role="status">{notice}</span>}
    </form>
  );

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
