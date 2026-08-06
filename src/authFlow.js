export const EMAIL_OTP_LENGTH = 6;

export function isNativeRuntime(runtime = globalThis) {
  const host = runtime?.window ?? runtime;
  return Boolean(host && '__TAURI_INTERNALS__' in host);
}

export function normalizeEmailOtp(value) {
  return String(value ?? '').replace(/\D/g, '').slice(0, EMAIL_OTP_LENGTH);
}

export function isCompleteEmailOtp(value) {
  return normalizeEmailOtp(value).length === EMAIL_OTP_LENGTH;
}

// A Tauri bundle cannot receive an https:// origin redirect. Native requests
// therefore omit emailRedirectTo and finish in-app with verifyOtp. Browser
// requests keep the existing magic-link redirect behaviour.
export function emailSignInOptions({ native, webOrigin }) {
  return native
    ? { shouldCreateUser: true }
    : { shouldCreateUser: true, emailRedirectTo: webOrigin };
}

export function emailOtpVerification(email, token) {
  return {
    email: String(email ?? '').trim(),
    token: normalizeEmailOtp(token),
    type: 'email',
  };
}
