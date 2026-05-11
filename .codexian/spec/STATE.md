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

current_phase: 4

## Last seal

last_sealed_phase: 4
last_sealed_at: 2026-05-11T15:49:56.244Z

## Active work

<!-- What is being worked on right now. Updated by executors. -->

- Phase 4 sealed. No active phase work; next step is to define phase 5 (or call this branch ready to merge to main).

## Recent decisions

- 2026-05-11T15:49:56.244Z — Sealed phase 4 (Validation depth and scope sealing). All three chunks shipped + self-applied: verify-failure auto-append (commits a19a70b1 + bc93c3c4), PLAN file split (e4c35584 + 0f97453b), plan-checker blocking gate (3ffd83df + 2008d06f). plans/phase-4.PLAN.md is the first plan file written through the new gate. 71/71 spec tests green. No phase 5 in ROADMAP yet — current_phase left at 4 until a phase 5 is added.

- 2026-05-11T11:04:40Z — Phase 4 chunk 2 (PLAN file split) shipped in commits e4c35584 + 0f97453b. plans/phase-2.PLAN.md and plans/phase-3.PLAN.md migrated, ROADMAP marker bodies collapsed to one-line back-compat references, extractor resolves plan file first / ROADMAP markers second / null when neither, session-start hook loads the current-phase plan file, FILENAME_KIND_HINTS recognises plans/phase-N.PLAN.md, doctor allows plans/ as a known top-dir. 31/31 spec tests green; validate OK at repo root.

- 2026-05-11T10:58:11Z — Starting phase 4 chunk 2 (PLAN file split). Phase 3 is sealed (the "upstream regression" framing turned out wrong — Codex 0.129+ requires a trust hash, which `registerHook` now writes automatically). The phase-4 Goal/CONTEXT preamble has been corrected to drop the stale "upstream-blocked" language.

- 2026-05-11T10:31:16Z — Opened phase 4 (Validation depth and scope sealing) and flipped phase 3 to `[!]` blocked pending upstream Codex hook fix. Phase 3 verify evidence (Ralph runs on Codex 0.128 / 0.130 / 0.131-alpha) is sufficient to know the upstream regression is real; we wait rather than implement against a broken target.

- 2026-05-11T10:27:52.865Z — Ralph completed: verify-codex-hook-regression (phase 3) — 0.128 PASS, 0.130 + 0.131-alpha.4 NO_NOT_PRESENT. Doctor surfaces; AGENTS.md is primary load channel. Evidence: docs/codex-hook-regression.md, src/spec/doctor.ts, openai/codex#21639.

- 2026-05-11T08:22:18.923Z — Sealed phase 2 and advanced to phase 3.

- 2026-05-11T08:19:52.063Z — Ralph completed: verify-ralph-mode (phase 2) — Ralph completion audit passed with 5 spec files read + AC-5 next-improvement identified Evidence: .codexian/spec/verify/PHASE-2-RALPH-RUN-20260511T064510Z.md.

- 2026-05-11T08:19:51.951Z — Ralph completed: verify-skill-path (phase 2) — spec-state-update skill applies allowed change + refuses forbidden last_sealed_phase edit Evidence: .codexian/spec/verify/PHASE-2-SKILL-RUN-20260511T063715Z.md.

- 2026-05-11T08:19:51.835Z — Ralph completed: verify-agents-md-path (phase 2) — Codex exec reads 5 spec files + correct Q1/Q2 with line-number citations Evidence: .codexian/spec/verify/PHASE-2-RUN-20260511T063416Z.md.

- 2026-05-11T08:15:34Z — Adopted `D-NN` decision ID format and added plan-coverage gate to `codexian spec validate`. See CONTEXT.phase-2.md D-01..D-05.
- 2026-05-11T06:27:43.644Z — Sealed phase 1 and advanced to phase 2.

<!-- Append-only log of decisions that affect future work. Most recent at top. -->

<!-- 2026-01-01T00:00:00Z — Decided to use X over Y because Z. Affects phases 2–4. -->

## Open blockers

<!-- Things that prevent the current phase from completing. -->

- _TODO_

## Notes

<!-- Anything else workers/humans need to know to pick up from where the previous session left off. -->
