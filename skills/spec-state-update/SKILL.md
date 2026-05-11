---
name: spec-state-update
description: Owner skill for the POSITION kind — non-trivial STATE.md updates. Routine appends to Active work / Recent decisions may bypass this skill; structural changes go through it.
---

# Spec State Update — POSITION Owner

`$spec-state-update` is the structured way to make non-trivial
updates to `.codexian/spec/STATE.md` (kind: POSITION). For routine
appends — adding a new line to `## Active work` or `## Recent
decisions` — agents may edit STATE.md directly. This skill is for
the cases that need structure: transitioning phases, recording
blockers, summarizing a recent-decisions run, or rewriting a
section's structure.

## Usage

```
$spec-state-update                                interactive walkthrough
$spec-state-update phase-transition <N>           record advancing to phase N
$spec-state-update blocker add "<text>"           append blocker
$spec-state-update blocker clear <id>             remove resolved blocker
$spec-state-update decisions summarize            consolidate recent-decisions
```

## What this skill does

1. Read `STATE.md` and the matching `CONTEXT.phase-N.md` (if any).
2. Apply the requested change while preserving:
   - The `current_phase: N` line exactly as parseable by the
     session-start hook.
   - The `last_sealed_phase` and `last_sealed_at` values — these are
     **owned by `codexian spec seal`** and must NEVER be touched here.
3. Always include an ISO 8601 timestamp on any new entry to
   `## Recent decisions`. The format is:
   `- YYYY-MM-DDTHH:MM:SSZ — <one-line decision>. <why>.`
4. After editing, run a quiet `codexian spec validate` and surface
   only the issues touching STATE.md.

## Strict rules

- **NEVER modify `last_sealed_phase` or `last_sealed_at`.** These
  are managed by the seal flow. If they look stale to you, that is
  a bug in seal, not a thing to patch by hand.
- **NEVER reformat the `current_phase: N` line.** The session-start
  hook parses it with a strict regex.
- **Do not delete entries from `## Recent decisions`** — that
  section is append-only by convention. To correct a wrong entry,
  append a corrective entry instead.
- **Do not move work between phases by editing STATE.md alone.**
  Phase transitions go through `$spec-seal` or `$spec-roadmap`.

## When to bypass this skill

Routine direct edits to `STATE.md` are allowed (and encouraged) for:
- Appending a new line to `## Active work` when starting a task.
- Appending to `## Recent decisions` after a small decision.
- Removing a line from `## Active work` when the task is done.

Anything beyond append/remove on those two sections should come
through this skill.
