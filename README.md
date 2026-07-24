# Soupz

**You bring your own AI and your own plan. Soupz maintains it.**

A study-plan tracker that doesn't just generate a plan — it *maintains* one:
reschedules when you fall behind, spaces revision so it sticks, tracks attendance
against your college's rule, and moves everything around your real exam dates.

One React codebase ships two ways:

- **Web / PWA** — installable, offline-capable, deployed on Vercel.
- **macOS menu-bar app** — a native Tauri shell with a tray panel and self-update.

---

## Quick start

```bash
npm install
cp .env.example .env      # fill in Supabase values (or leave blank for local-only)
npm run dev               # http://localhost:5173
```

With `.env` blank the app runs **local-only**: no sign-in, progress lives in
`localStorage`. Fill in the two Supabase values and it switches to **multi-user**
with per-user cloud sync.

## Environment

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL. Blank → local-only mode. |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon (public) key. Safe to ship — RLS scopes every row to the signed-in user. |
| `VITE_ENABLE_GOOGLE` | `true` to show "Continue with Google" (needs OAuth configured). Unset → email-only. |

Never put the Supabase `service_role` key in the client.

## Builds

```bash
npm run build       # single-file bundle in dist/  (used by the macOS app)
npm run build:web   # PWA build in dist-web/        (deployed to the web)
```

The two are mutually exclusive per build: `build` inlines everything into one
file (no service worker), `build:web` emits a service worker + manifest + hashed
assets for offline use.

## Deploy (web)

Vercel builds `npm run build:web` → `dist-web/` (see `vercel.json`). Set the
`VITE_SUPABASE_*` variables in the Vercel project so the deployed app has auth.

## macOS app

```bash
npm run tauri build   # signed .app + .dmg + updater artifacts
```

The window loads the deployed web URL, so content self-updates; the app binary
auto-updates via the signed updater manifest.

## Multi-user backend (Supabase)

1. Create a Supabase project.
2. Apply `supabase/migrations/20260724000000_multiuser.sql` (per-user RLS on every
   table — no API-key column; users' AI keys stay client-side).
3. Enable Email (and optionally Google) auth; add your URLs to the redirect
   allow-list.
4. Put the project URL + anon key in `.env` (and in Vercel).

## Project structure

```
src/
  App.jsx           the app: today / academics / calendar / … views
  Auth.jsx          sign-in gate (local-only fallback when unconfigured)
  sync.js           auth-aware Supabase sync, per-user
  InstallPrompt.jsx PWA add-to-home-screen prompt
  soupz.css         the whole visual system (warm, hand-drawn)
  soup.jsx          the bowl / SVG components
  data/             plan content (schedule, DSA, academics, …)
src-tauri/          the macOS shell (tray, panel, updater) — Rust + Tauri v2
supabase/           SQL migrations
public/             PWA icons + favicon
```

## Tech

React 18 · Vite 6 · Tauri v2 · Supabase (Postgres + Auth + RLS) · vite-plugin-pwa.

## License

Copyright © 2026 Soham Prajapati.

Soupz is free and open source under the **GNU AGPL-3.0** ([`LICENSE`](LICENSE)).
You may use, study, modify and share it — provided you **keep the attribution**
and **release your changes under the same license**, including when you run a
modified version as a network service. See the license for the exact terms.

Soupz is free to use today. A hosted/subscription tier may be offered later; the
AGPL keeps the source open regardless, and separate commercial terms can be
arranged for anyone who cannot comply with the copyleft.
