# Hackathon mode

Hackathon mode is a projection inside Soupz Tracker, not a separate application.
It maintains a plan the user enters: plan dates, demo goal, workstreams,
milestones, dated tasks, blockers and whether a task is required for the demo.
The editor does not invent event content. An optional review-first extractor
calls only the endpoint the user configures with text they paste, and nothing is
saved until they explicitly confirm the candidate.

## Data boundary

The mode stores a versioned plan document under the `hackathonPlan` store key.
The shape follows the generic plan schema intended for the local MCP surface:

- top-level `schemaVersion`, opaque `id`, `revision`, `kind`, `timezone`,
  `window`, `source` and timestamps;
- workstreams in `tracks[]`, carrying plain hex colours;
- dated tasks in `schedule[].tasks[]`, with opaque stable ids;
- milestones in `events[]` as fixed events;
- hackathon-only projection fields under `ext.hackathon`.

Completion stays in the existing separate `done` progress map. Structural plan
edits never rewrite completion ids. Removing a task is explicit and retains its
orphaned completion entry so an import or future revision with the same id can
recover it.

The standard workspace contains only plans the user creates or explicitly
imports. A regression test snapshots a generic habit plan and proves that
creating or projecting a hackathon plan cannot mutate it.

## Window and cloud sync

`trackerMode`, `hackathonPlan` and `done` all use the same store hook. Main and
tray webviews receive changes over the Tauri process event bus, while browser
tabs use `BroadcastChannel` (with the storage event as fallback). The tray only
projects today's tasks for the active mode; it does not duplicate the full
hackathon editor.

Completion rows can use the existing Supabase progress table because task ids
are opaque strings. The full hackathon plan document is deliberately local-only
until a versioned plans table/local MCP persistence layer is implemented. The UI
does not imply cross-device plan-document sync that the backend cannot yet
provide.

## Future local MCP compatibility

A local MCP writer can persist the same document without translating UI-specific
state. It should validate `schemaVersion`, preserve task ids across revisions,
return a structural diff before replacement, and keep progress as a separate
document. Unknown `ext` keys must survive a read/write round trip so optional
domain projections remain client-agnostic.
