# Contributing to Soupz Tracker

Soupz Tracker is a local-first plan maintainer: bring your own plan, the app
maintains it. A new install starts empty by design — there is no bundled
curriculum, authored schedule, or generated default plan. Contributions that
respect that principle are very welcome.

## Privacy rules for contributions (read this first)

This is a public, generic tracker. Contributions must never introduce:

- personal data of any real person (names, marks, phone numbers, records);
- real timetables, real course schedules, or real institution-specific content
  (course codes, faculty names, campus details);
- example or fixture data derived from a real person's plan.

All example data, fixtures, and test plans must be synthetic and obviously
generic (e.g. "Track A", "Sample habit", invented dates). PRs that embed real
personal or institutional data will be closed and the history treated as
contaminated. The same applies to screenshots: only synthetic demo data.

## Prerequisites

- Node.js (recent LTS; the test runner uses the built-in `node --test`)
- npm
- For desktop builds only: the Tauri v2 toolchain (Rust)

## Development setup

```bash
git clone <your fork>
cd tracker
npm install
cp .env.example .env
npm run dev
```

Leave the Supabase values in `.env` blank for local-only operation — the app is
fully functional without any backend. Never put a service-role key or an
AI-provider key in the client environment, and never commit `.env`.

## Running tests

```bash
npm test
```

This runs `node --test` over `src/*.test.js`, `packages/core/test/*.test.js`,
and `packages/mcp/test/*.test.js` with concurrency 1. No extra test framework
is used — new tests should use the built-in `node:test` module and follow the
existing files' style.

## Builds

```bash
npm run build       # single-file bundle embedded by Tauri
npm run build:web   # PWA output (dist-web)
npm run preview:web # build + local preview of the PWA
npm run tauri build -- --bundles app,dmg   # desktop app (requires Tauri toolchain)
```

## Code style

- Plain JS ES modules for core logic; React 18 for the UI layer.
- Keep core logic dependency-light — `packages/core` should stay runnable under
  plain `node --test`.
- Completion stays separate from plan structure; missed and empty days remain
  neutral. Do not add streak-shaming or punitive mechanics — this is a product
  decision, not a style preference.
- Plan documents are versioned JSON; changes to the schema need a migration
  story and discussion in an issue first.

## Proposing a change

1. Open an issue describing the problem before large changes.
2. Branch from the default branch; keep PRs focused.
3. Fill in the PR template with what/why and how you tested.

## What maintainers look for

- `npm test` passes; new logic has tests.
- The empty-start principle holds: no bundled plans, no default curriculum.
- No personal or institution-specific data anywhere (see privacy rules above).
- No credentials in the diff; client env stays limited to the documented
  `VITE_*` variables.
- Docs updated when behavior or schema changes.

## What not to change

- **Brand assets** (logos, icons) are locked and not accepted in PRs.
- **Product names are fixed.** "Soupz Tracker" and related Soupz names are not
  open to renaming.

## Conduct

Be respectful and constructive. A formal code of conduct may be adopted later;
until then, ordinary professional courtesy applies.
