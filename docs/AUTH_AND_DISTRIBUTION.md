# Authentication and distribution

This file separates what the repository can build from what must be configured
in Supabase, Apple, or GitHub. A successful local build is not evidence that
those external steps are complete.

## Choose a build mode

### Local-only: easiest to share

Leave `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` unset. Soupz Tracker opens
without an account and stores progress in that installation's `localStorage`.
There is no cross-device sync. This mode needs no Supabase project or secret.

The current `.github/workflows/release.yml` deliberately builds this mode: it
does not pass either `VITE_SUPABASE_*` variable to the Tauri build.

### Connected: account and cloud sync

Set both client variables before building:

- `VITE_SUPABASE_URL`: the project URL.
- `VITE_SUPABASE_ANON_KEY`: the public anon/publishable client key.

These Vite values are compiled into the client bundle. Never use a Supabase
`service_role` or secret key here. Apply
`supabase/migrations/20260724000000_multiuser.sql` and confirm its per-user RLS
policies before distributing a connected build.

## Email sign-in contract

| Runtime | Request | Return path |
|---|---|---|
| Web | `signInWithOtp` with `emailRedirectTo = window.location.origin` | Open the same-origin magic link; a displayed code can also be entered in-app. |
| Tauri | `signInWithOtp` with no `emailRedirectTo` | Enter the six-digit email code; `verifyOtp({ email, token, type: 'email' })` creates the session in the current webview. |

Google OAuth is hidden in Tauri because this repository does not register and
handle a native OAuth callback. `VITE_ENABLE_GOOGLE=true` only enables the web
button.

Supabase chooses OTP and magic-link email behaviour from the template variables:
[`{{ .Token }}` supplies the OTP and `{{ .ConfirmationURL }}` supplies the
link](https://supabase.com/docs/reference/javascript/auth-signinwithotp). The
verification call follows Supabase's documented
[`verifyOtp` email flow](https://supabase.com/docs/reference/javascript/auth-verifyotp).

### Required Supabase dashboard work

This cannot be applied or verified from this repository:

1. In Authentication → URL Configuration, set the production web Site URL and
   allow the exact production web origin used by `emailRedirectTo`. Add a local
   development origin only when it is actually used.
2. Keep the email OTP length at six digits; the native input deliberately
   accepts exactly six numeric characters.
3. In Authentication → Email Templates, update both the first-user confirmation
   template and the returning-user magic-link template. Use a dual-purpose body
   so the same project serves native OTP and web link users:

   ```html
   <h2>Sign in to Soupz Tracker</h2>
   <p>Your six-digit verification code is:</p>
   <p style="font-size: 28px; font-weight: 700; letter-spacing: 0.2em;">
     {{ .Token }}
   </p>
   <p>Using Soupz Tracker on the web?</p>
   <p><a href="{{ .ConfirmationURL }}">Sign in in this browser</a></p>
   <p>If you did not request this email, you can ignore it.</p>
   ```

   Supabase documents all available variables in its
   [email-template guide](https://supabase.com/docs/guides/auth/auth-email-templates).
4. Test all four cases with disposable accounts before release: first-time web,
   returning web, first-time DMG, and returning DMG. For web, verify the link
   returns to the deployed origin. For DMG, verify the six-digit code signs in
   without opening a browser callback.

Do not mark connected native onboarding ready until step 3 passes against the
actual hosted Supabase project. The UI cannot detect a dashboard template that
still sends only a browser link.

## Reproducible local checks

Install and verify the JavaScript surfaces:

```bash
npm ci
npm test
npm run build:web
npm run build
```

Build the macOS app and DMG on macOS:

```bash
npm run tauri build -- --bundles app,dmg
```

Expected output locations are under:

- `src-tauri/target/release/bundle/macos/Soupz Tracker.app`
- `src-tauri/target/release/bundle/dmg/`

The `.app` and `.dmg` are build artifacts, not proof of signing or
notarization. Tauri's distribution guide states that direct macOS distribution
requires both [code signing and notarization](https://v2.tauri.app/distribute/).

## Apple release gate

For a public DMG outside the Mac App Store, an authorized release owner must:

1. Install or provision a valid Developer ID Application certificate.
2. Provide the Apple notarization credentials supported by Tauri.
3. Build the final DMG in that authenticated environment.
4. Verify the exact final app and DMG, for example:

   ```bash
   codesign --verify --deep --strict --verbose=2 "src-tauri/target/release/bundle/macos/Soupz Tracker.app"
   spctl --assess --type execute --verbose=2 "src-tauri/target/release/bundle/macos/Soupz Tracker.app"
   xcrun stapler validate "src-tauri/target/release/bundle/macos/Soupz Tracker.app"
   ```

5. Install the DMG on a clean Mac account and test first launch, email sign-in,
   the tray panel, tray↔main progress sync, quit, and relaunch.

Follow Tauri's current
[macOS signing and notarization guide](https://v2.tauri.app/distribute/sign/macos/).
This repository does not prove that an Apple certificate or notarization
credential exists, and local unsigned or ad-hoc artifacts must not be described
as notarized.

## Updater release gate

Automatic updates are intentionally disabled. There is no configured public
key, endpoint, or `latest.json` in this repository, so no local artifact can
silently check a copied or unverified update channel. Tauri's
[updater signing guide](https://v2.tauri.app/plugin/updater/) describes the
work required before an authorized release owner enables it.

Before publishing an update, an authorized release owner must confirm:

- the GitHub Actions secrets contain the private key matching the new public key
  configured for the intended channel;
- the release produced the `.app.tar.gz` updater bundle and matching `.sig`;
- `latest.json` contains the new version, platform URL, and the contents of the
  matching signature file;
- the newly configured endpoint serves that exact manifest and artifact over HTTPS;
- an older signed installation can discover, download, verify, install, and
  relaunch into the new version.

The presence of secret *names* in `.github/workflows/release.yml` does not prove
that GitHub has values for them. Do not claim updater signing is complete until
the published upgrade test succeeds.

## Publish checklist

- [ ] `npm test` passes.
- [ ] `npm run build:web` passes.
- [ ] Final Tauri build passes in the intended local-only or connected mode.
- [ ] Connected mode: hosted Supabase templates and all four auth cases pass.
- [ ] Apple Developer ID signature verifies.
- [ ] Apple notarization and stapling validate.
- [ ] Tray↔main progress synchronization passes in the packaged app.
- [ ] A newly configured updater artifact signature and upgrade-from-previous-version pass.
- [ ] The exact artifacts being published match the tested artifacts.

Only the first three items can be completed without access to external accounts
or signing material.

## Preserved local verification artifact

The locally generated native output is intentionally quarantined at
`src-tauri/target/release/bundle/local-only-unsigned/`. Every artifact filename
states `LOCAL-ONLY` and/or `UNSIGNED`, and the directory contains
`DO-NOT-DISTRIBUTE-AS-CLOUD-AUTH_BUILD_STATUS.txt` with its exact hashes.

That DMG was built with both Supabase client variables explicitly blank and
Tauri's `--no-sign` option. It is useful only for structural/local-mode
verification: it has no signup or cloud sync, is not Apple-signed or notarized,
and its updater archive has no signature. It must not be sent as the finished
connected onboarding build.
