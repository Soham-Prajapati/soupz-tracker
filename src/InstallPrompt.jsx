import React, { useEffect, useState } from 'react';

// "Install Soup Tracker" prompt.
//
// Listens for the browser's `beforeinstallprompt` event (Chromium/Android),
// shows a small dismissible pill, and calls the deferred prompt on click.
// Renders nothing inside the Tauri Mac app or on iOS Safari (the event never
// fires there) — except that on iOS we show a one-line "Add to Home Screen"
// hint instead, since Safari has no programmatic install.
//
// A dismissal is remembered in localStorage so the user is never nagged twice.

const DISMISS_KEY = 'soupz.installDismissed';

function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari
    window.navigator.standalone === true
  );
}

function isIOS() {
  return (
    /iphone|ipad|ipod/i.test(window.navigator.userAgent) &&
    !/crios|fxios/i.test(window.navigator.userAgent)
  );
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null); // BeforeInstallPromptEvent
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone()) return; // already installed
    if (localStorage.getItem(DISMISS_KEY)) return; // user said no

    const onPrompt = (e) => {
      e.preventDefault(); // stop Chrome's default mini-infobar
      setDeferred(e);
      setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
      try { localStorage.setItem(DISMISS_KEY, '1'); } catch {}
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);

    // iOS has no beforeinstallprompt — offer a manual hint after a short delay.
    let t;
    if (isIOS()) {
      t = setTimeout(() => { setIosHint(true); setVisible(true); }, 1200);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      if (t) clearTimeout(t);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch {}
  };

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch {}
    setDeferred(null);
    setVisible(false);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch {}
  };

  if (!visible) return null;

  return (
    <div style={S.wrap} role="dialog" aria-label="Install Soup Tracker">
      <div style={S.card}>
        <div style={S.body}>
          <div style={S.title}>Install Soup Tracker</div>
          <div style={S.sub}>
            {iosHint
              ? 'Tap Share, then “Add to Home Screen.”'
              : 'Keep your plan one tap away — works offline.'}
          </div>
        </div>
        {!iosHint && (
          <button style={S.cta} onClick={install}>Install</button>
        )}
        <button style={S.close} onClick={dismiss} aria-label="Dismiss">
          {'×'}
        </button>
      </div>
    </div>
  );
}

// Inline styles that read the app's own CSS custom properties, so the prompt
// picks up the chosen accent and the light/dark paper palette automatically.
const S = {
  wrap: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 'max(16px, env(safe-area-inset-bottom))',
    display: 'flex',
    justifyContent: 'center',
    pointerEvents: 'none',
    zIndex: 9999,
    padding: '0 16px',
  },
  card: {
    pointerEvents: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    maxWidth: 420,
    width: '100%',
    padding: '12px 12px 12px 16px',
    background: 'var(--paper3, #FBF4E7)',
    color: 'var(--ink, #2B2118)',
    border: '1px solid var(--paper-edge, #DCC9A8)',
    borderRadius: 14,
    boxShadow: '0 8px 30px rgba(0,0,0,.18)',
    font: '400 14px/1.35 "Nunito Sans", system-ui, sans-serif',
  },
  body: { flex: 1, minWidth: 0 },
  title: { fontWeight: 700, fontSize: 15, marginBottom: 2 },
  sub: { color: 'var(--ink2, #6B5945)', fontSize: 13 },
  cta: {
    flexShrink: 0,
    border: 'none',
    borderRadius: 10,
    padding: '9px 16px',
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
    color: '#fff',
    background: 'var(--broth, #E2963C)',
  },
  close: {
    flexShrink: 0,
    width: 30,
    height: 30,
    display: 'grid',
    placeItems: 'center',
    border: 'none',
    background: 'transparent',
    color: 'var(--ink3, #9C8B72)',
    fontSize: 20,
    lineHeight: 1,
    cursor: 'pointer',
  },
};
