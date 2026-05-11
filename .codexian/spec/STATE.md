<!-- SPEC:DOC:STATE -->
<!-- spec:kind: POSITION -->
<!-- spec:author: executor -->
<!-- spec:mutability: mutable -->
<!-- spec:load: always -->
<!-- spec:forcing: no -->
<!-- schema_version: 1 -->

# STATE

> **For agents reading this file:**
> This is the POSITION doc. Author: executor. This is the **only**
> spec file you may freely edit during normal coding work. The owner
> skill is `$spec-state-update` but for routine append-to-Active-work
> or append-to-Recent-decisions you may edit directly.
> You MUST NOT modify the `last_sealed_phase` or `last_sealed_at`
> fields — those are owned by `codexian spec seal`. You MUST NOT
> change the format of the `current_phase: N` line; the session-start
> hook parses it. Increment `current_phase` only as part of a seal
> transition.
> Always-loaded; keep under ~120 lines.

> Current position and recent decisions. The *only* file that changes frequently during normal work.
> Workers and humans read this to know "where are we right now."

## Current phase

current_phase: 2

## Last seal

last_sealed_phase: 1
last_sealed_at: 2026-05-11T06:27:43.644Z

## Active work

<!-- What is being worked on right now. Updated by executors. -->

- Implementing Decision ID + plan coverage gate in src/spec/decisions.ts and src/spec/validate.ts (AC-6/AC-7)

## Recent decisions

- 2026-05-11T08:15:34Z — Adopted `D-NN` decision ID format and added plan-coverage gate to `codexian spec validate`. See CONTEXT.phase-2.md D-01..D-05.
- 2026-05-11T06:27:43.644Z — Sealed phase 1 and advanced to phase 2.

<!-- Append-only log of decisions that affect future work. Most recent at top. -->

<!-- 2026-01-01T00:00:00Z — Decided to use X over Y because Z. Affects phases 2–4. -->

## Open blockers

<!-- Things that prevent the current phase from completing. -->

- _TODO_

## Notes

<!-- Anything else workers/humans need to know to pick up from where the previous session left off. -->
