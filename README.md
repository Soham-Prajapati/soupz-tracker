# Soupz Tracker

**Bring your own plan. Soupz maintains it.**

Soupz Tracker is a local-first plan maintainer. A new install starts empty: add
a habit with a name and cadence, or review and import a versioned JSON plan.
There is no bundled curriculum, authored schedule, or generated default plan —
the tracker maintains plans, it does not author them.

## Who it is for

- People who already have a plan — a habit cadence, a study or training
  schedule, a project timeline — and want it maintained, projected onto days,
  and rescheduled honestly, without an app inventing content for them.
- Hackathon teams who want workstreams, milestones, blockers, and demo
  readiness in one portable JSON document they can pass around.
- Agent and automation users, through a local MCP server over the same
  versioned engine.

## Current maturity

Pre-release. The web PWA and the macOS desktop app build and pass their test
suites locally, but there is no signed, notarized, or published release yet,
and automatic updates remain disabled until a real signed release channel
exists. The mobile directory is a compilable Flutter contract scaffold, not a
claimed mobile product. Do not treat a local `.app` or `.dmg` as a release.

## Architecture

```text
packages/core/              plan schema, repository and deterministic engine
packages/mcp/               six-tool local MCP surface over the core
src/App.jsx                 generic Today, Plans and Settings workspace
src/genericTracker.js       browser projection/write/reschedule adapter
src/HackathonWorkspace.jsx  hackathon editor and review-first import UI
src/hackathonMode.js        immutable hackathon plan edits and projection
src/hackathonImport.js      extractor boundary, validation and portable JSON
src/windowStore.js          cross-window transport and Rust state client
src/sync.js                 optional per-user progress convergence
src/soup.jsx                progress SVG components
src/soupz.css               responsive visual system
src-tauri/                  atomic desktop state, tray and Tauri shell
mobile/                     iOS/Android contract scaffold and fixtures
supabase/                   optional backend schema and migrations
```

One deterministic engine (`packages/core`) owns the plan schema and all
projections. The React workspace, the Tauri desktop shell, the MCP server, and
the mobile contract scaffold are all clients of that engine. On desktop, a
Rust-owned atomic state document is the single source of truth shared by every
window and the tray; browser builds use local storage instead.

## Prerequisites

- Node.js 20 or newer with npm (CI builds on Node 20).
- For the desktop app: stable Rust and the Tauri v2 platform prerequisites
  (on macOS, the Xcode Command Line Tools).
- Optional: a Supabase project, only for the connected account/sync mode.
- Optional: Flutter, only for the mobile contract scaffold in `mobile/`.

## Environment variables

Copy `.env.example` to `.env` and fill values locally; never commit filled
values. The optional Supabase transport reads only:

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Project URL; blank keeps the runtime local-only. |
| `VITE_SUPABASE_ANON_KEY` | Public client key protected by per-user RLS. |
| `VITE_ENABLE_GOOGLE` | Enables the optional Google auth control when auth UI is used. |
| `SOUPZ_MCP_TOKEN` | Required only for the optional local MCP HTTP mode; stdio needs no token. |

Never put a service-role key or an AI-provider key in the client environment.

## Local development

```bash
npm install
cp .env.example .env
npm run dev          # web workspace on Vite
npm run tauri dev    # desktop shell (requires Rust)
```

Leave the Supabase values blank for local-only operation.

## Tests

```bash
npm test                                              # Node test suite (src + packages)
cargo test --locked --manifest-path src-tauri/Cargo.toml   # Rust state tests
```

`npm test` runs the engine, MCP, workspace, and release-configuration suites,
plus a privacy regression test that builds the production bundle and rejects
known private campaign copy or imports from the removed data modules.

## Production build

```bash
npm run build                            # single-file bundle embedded by Tauri
npm run build:web                        # PWA output in dist-web
npm run tauri build -- --bundles app,dmg # local macOS desktop bundles
```

## Installation

There is no published install channel yet. Until a signed release exists,
build from source with the commands above and use the resulting `.app`, or
install the PWA from a `npm run preview:web` serve. The release workflow and a
Homebrew tap are prepared as the intended future channels.

## First-run setup

A fresh install opens empty, with no account required. Add a habit with a name
and cadence, or import a versioned JSON plan through the review-first import
card. Nothing is saved from an import until you confirm the reviewed candidate.
Connected desktop builds additionally require the Supabase email templates
described in [auth and distribution](docs/AUTH_AND_DISTRIBUTION.md) so the app
receives a six-digit sign-in code.

## Normal daily use

The standard workspace renders every user-owned plan together. Track colours
travel with plan data, completion remains separate from structure, and a task
can move to any date with an explicit undo. Missed and empty days are neutral;
streaks are derived context, not punishment. On desktop the tray mirrors the
main window instantly, and both survive restart through the same Rust state
document.

Hackathon mode uses the same generic schema for workstreams, milestones,
blockers, and demo readiness. Its optional extractor sends only text the user
pastes to an endpoint they configure, holds the key in component memory for one
request, and requires review before a plan is saved.

## Optional integrations

- **Supabase** — account sign-in and per-user progress sync; blank variables
  keep everything local. See [auth and distribution](docs/AUTH_AND_DISTRIBUTION.md).
- **Google sign-in** — an optional auth control behind `VITE_ENABLE_GOOGLE`.
- **MCP** — `npm run mcp` serves the six-tool local MCP surface over stdio;
  HTTP mode is optional, binds to `127.0.0.1` only, and requires
  `SOUPZ_MCP_TOKEN`. See the [MCP package](packages/mcp/README.md).
- **Hackathon extractor** — user-configured endpoint, review-first, nothing
  stored server-side by the tracker.

## Troubleshooting

- **App opens without an account and never syncs** — expected local-only mode;
  set both `VITE_SUPABASE_*` variables at build time for the connected mode.
- **Desktop sign-in email arrives without a six-digit code** — the Supabase
  email templates from [auth and distribution](docs/AUTH_AND_DISTRIBUTION.md)
  are not applied.
- **Browser and desktop show different progress** — they use different stores
  by design (local storage vs. the Rust state document); use one surface or the
  connected mode to converge.
- **MCP HTTP mode refuses to start** — set `SOUPZ_MCP_TOKEN` and a port, or use
  the default stdio transport, which needs neither.
- **No automatic updates** — intentional; updates ship only once a signed
  release channel exists.

## Data storage and privacy

Browser plan documents live in local storage. On desktop, plan documents use
the atomic `engine-state.json` document in the app data directory — the same
repository the local MCP server reads — and the app refreshes it while open.
Browser builds cannot access the MCP process's local file and remain explicitly
local. The client contains no analytics or telemetry. Nothing leaves the
machine unless you configure Supabase (per-user rows behind RLS) or explicitly
paste text into the hackathon extractor for one request to an endpoint you
chose.

Authored plan content is intentionally absent from this repository. The privacy
regression test enforces this on every `npm test` run.

## Backup, export and import

Every plan exports as a versioned JSON file (`Export current plan` in both the
standard and hackathon workspaces). The same files import through the
review-first import cards, including the portable teammate JSON flow in
hackathon mode. On desktop, copying `engine-state.json` from the app data
directory backs up the full state; the JSON exports are the supported
cross-install format.

## Release process

Pushing a `v*` tag runs the GitHub Actions release workflow on macOS (Apple
Silicon), which builds the deliberately local-only mode — it passes no
`VITE_SUPABASE_*` variables. Artifacts are unsigned until a real signing and
notarization channel is set up, and the updater stays disabled until then.

## Known limitations

- No signed, notarized, or published builds; automatic updates disabled.
- `mobile/` is a versioned contract scaffold only.
- Local-only mode has no cross-device sync by design.
- Connected mode requires manual Supabase setup, including RLS migration and
  email templates, before distribution.

## Relationship to other Soupz products

Soupz Tracker is the generic, public member of the soupz family: it maintains
whatever plan you bring and ships with no authored content. Personal plan
content belongs in a user's own imports or in the separate private Soupz
Personal product, and never in this repository. The tracker shares the family's
visual system and the versioned plan schema consumed by its MCP surface and
mobile contract.

## Deeper documentation

- [Hackathon mode](docs/HACKATHON_MODE.md)
- [Auth and distribution](docs/AUTH_AND_DISTRIBUTION.md)
- [MCP package](packages/mcp/README.md)
- [Mobile contract scaffold](mobile/README.md)
- [Contributing](CONTRIBUTING.md)

## License

Copyright © 2026 Soham Prajapati.

Soupz is licensed under the [GNU AGPL-3.0](LICENSE). You may use, study, modify,
and share it under the license terms, including the network-use source
obligation. Separate commercial terms can be arranged when AGPL compliance is
not suitable.
