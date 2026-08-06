# CANONICAL SOUPZ AI GUARDRAILS & OPERATING RULES

> **Owner & User**: Always address the user as **Shubh** in every progress update, question, checkpoint, and final response. Addressing him by name is a mandatory context-health indicator. If you cannot reliably retain loaded context, stop starting new work, update shared memory, and recommend a fresh session.
> **Scope**: Repository-owned, human-reviewable canonical source of truth for all AI agents working on the Soupz product family.

---

## 1. CREDENTIAL SECURITY RULES

1. **Never write a live credential into a tracked file.** Passwords, API keys, private tokens, connection strings with embedded credentials, and private keys must never be committed.
2. **Environment Variables**: Real values belong in `.env` (or `.env.local`), and `.env` / `.env.local` MUST be present in `.gitignore`.
3. **Example Configs**: Commit `.env.example` containing required key names with empty values or explicit placeholder descriptions.
4. **Credential Identification & Escalation**: If a value looking like a secret or credential is found in code or configuration (whether adding, editing, or reading), identify its exact file path and line number, and ask **Shubh** explicitly whether it is real.
5. **No Secret Leaks**: Never paste actual secret values into chat, logs, tasks, commit messages, PR descriptions, or issue trackers.
6. **Pre-Push Diff Inspection**: Inspect the complete outgoing diff (`git diff @{u}..` or `git log -p`) before any push operation.
7. **Explicit Push Authorization**: Ask **Shubh** again before pushing any credential-shaped material, stating explicitly whether the remote target is public or private.
8. **History Retention Awareness**: Removing a secret line from a file does NOT remove it from Git history. A committed secret must be assumed harvested.
9. **Rotation Requirement**: Rotate any exposed credential immediately before undertaking Git history cleanup or repo resetting.
10. **Guardrail Protection**: Never disable pre-commit / pre-push hooks, change `core.hooksPath`, use `--no-verify`, or pass `ALLOW_SECRETS=1` on your own initiative.
11. **No Silent Actions**: Never silently strip out or refuse a suspicious value without notifying **Shubh**. Always present the decision to Shubh with exact location context.

---

## 2. IDENTITY, PRIVACY & BOUNDARIES

1. **User Identity**: Always address the owner as **Shubh**.
2. **Academic & Personal Privacy**: Personal academic records, marks, student details, and timetable data belonging to Shubh remain local and private.
3. **Lecturer Data Safeguard**: Named lecturer phone-use records, faculty personal details, or sensitive institution logs must NEVER enter a public repository or public dataset.
4. **Product Privacy Boundaries**: Data in `Soupz Personal` belongs strictly to Shubh. Shared functionality must use separate user/database credentials and documented export/import routines (`docs/SHARING.md`).

---

## 3. AUTHORITY & EXECUTION CONTROLS

1. **Explicit Permission Required**: No agent may `git push`, publish packages (npm/crates), deploy web applications (Vercel/Cloudflare), rewrite Git history, initialize new remotes, or delete repositories/data without Shubh's explicit prior approval.
2. **Implement & Test**: Agents implement code and execute tests; they do not merely output summaries or claim work is done without empirical verification.
3. **Incremental Disk Writes**: Write file updates incrementally. Do not load massive JSON files (e.g. `lab-ground-truth.json`) wholesale into context—use `jq` or Node queries. Never hold all file edits until the end of a long run.
4. **Clean Commits**: Never append `Co-Authored-By: Claude` or similar AI attribution trailers to commit messages.
5. **Independent Review**: No implementer agent may mark its own task `done`. A separate, independent review pass (blind, edge-case, and acceptance) is mandatory before marking a task `verified` or `done`.
6. **Claim Expansion**: If an agent's claimed write set changes during implementation, it must expand its claim using the claim tool prior to modifying the new target files.

---

## 4. PARALLEL EXECUTION & CLAIM PROTOCOL

1. **Concurrent Agents**: Multiple agents may operate concurrently in the same repository. Ownership is exclusive ONLY at the declared write surface (file, generated output, migration lane, or named symbol/section).
2. **Task Claims**: Every active task must have a registered claim under `_memory/claims/active/` listing its exact write paths and conflict keys.
3. **Worktree Isolation**: Use Git worktrees for parallel task packets whenever operating on clean baselines.
4. **Dirty Repository Handling**: Uncommitted baseline work must be preserved. Agents working in dirty repositories must only touch clean, disjoint files until a baseline strategy is approved by Shubh.

---

## 5. REVISION & DRIFT PREVENTION

1. **Canonical Source**: This file (`/Users/shubh/Developer/soupz/_memory/AI-GUARDRAILS.md`) is edited manually and serves as the master.
2. **Product Mirrors**: Every product subfolder contains a synchronized copy (`AI-GUARDRAILS.md`). Copies are generated and verified by `/Users/shubh/Developer/soupz/scripts/sync-ai-guardrails.py` and `/Users/shubh/Developer/soupz/scripts/verify-ai-guardrails.py`.
