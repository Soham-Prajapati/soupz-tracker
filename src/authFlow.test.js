import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import {
  EMAIL_OTP_LENGTH,
  emailOtpVerification,
  emailSignInOptions,
  isCompleteEmailOtp,
  isNativeRuntime,
  normalizeEmailOtp,
} from './authFlow.js';

test('native email sign-in never receives a browser redirect', () => {
  const options = emailSignInOptions({
    native: true,
    webOrigin: 'https://tracker.example',
  });

  assert.deepEqual(options, { shouldCreateUser: true });
  assert.equal('emailRedirectTo' in options, false);
});

test('web email sign-in preserves its same-origin magic-link return', () => {
  assert.deepEqual(emailSignInOptions({
    native: false,
    webOrigin: 'https://tracker.example',
  }), {
    shouldCreateUser: true,
    emailRedirectTo: 'https://tracker.example',
  });
});

test('email OTP input is normalized and verified as the Supabase email type', () => {
  assert.equal(EMAIL_OTP_LENGTH, 6);
  assert.equal(normalizeEmailOtp('12 3a-4567'), '123456');
  assert.equal(isCompleteEmailOtp('12345'), false);
  assert.equal(isCompleteEmailOtp('123 456'), true);
  assert.deepEqual(emailOtpVerification(' person@example.com ', '12 34-56'), {
    email: 'person@example.com',
    token: '123456',
    type: 'email',
  });
});

test('runtime detection distinguishes a Tauri webview from a browser', () => {
  assert.equal(isNativeRuntime({ window: { __TAURI_INTERNALS__: {} } }), true);
  assert.equal(isNativeRuntime({ window: {} }), false);
  assert.equal(isNativeRuntime({}), false);
});

test('verification state has an accessible one-time-code form while web keeps link copy', async () => {
  const originalWindow = globalThis.window;
  const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent',
  });

  try {
    const { SignIn } = await server.ssrLoadModule('/src/Auth.jsx');

    globalThis.window = { __TAURI_INTERNALS__: {} };
    const native = renderToStaticMarkup(React.createElement(SignIn, {
      initialSentEmail: 'person@example.com',
    }));
    assert.match(native, /<label[^>]+for="email-code"[^>]*>Six-digit code<\/label>/);
    assert.match(native, /autoComplete="one-time-code"/);
    assert.match(native, /inputMode="numeric"/);
    assert.match(native, /pattern="\[0-9\]\{6\}"/);
    assert.match(native, /Verify and continue/);

    globalThis.window = {};
    const web = renderToStaticMarkup(React.createElement(SignIn, {
      initialSentEmail: 'person@example.com',
    }));
    assert.match(web, /Open it in this browser/);
    assert.match(web, /Six-digit code \(if shown\)/);
    assert.match(web, /id="email-code"/);
  } finally {
    globalThis.window = originalWindow;
    await server.close();
  }
});
