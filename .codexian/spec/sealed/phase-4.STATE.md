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

last_sealed_phase: 3
last_sealed_at: 2026-05-11T10:50:19.294Z

## Active work

<!-- What is being worked on right now. Updated by executors. -->

- Phase 4 chunk 3 (next): plan-checker blocking gate on top of the existing Decision-ID coverage gate. Architect-tier reviewer signs off that the plan body is goal-aligned, not just D-NN complete. Most of the change is in `skills/spec-plan/SKILL.md` (insert architect call between $ralplan output and persistence). No new CLI subcommand expected.

## Recent decisions

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

### Handoff (2026-05-11T11:04:40Z)

Stopping at a clean point. Next session pickup brief:

**Where we are**
- Phase 4 chunks 1+2 done, chunk 3 (plan-checker blocking gate) is the only remaining work in phase 4.
- All current code green: `npm run build` clean, `node --test dist/spec/__tests__/*.test.js` 31/31, `codexian spec validate` OK at repo root, `codexian spec doctor` all PASS except the one trust-hash WARN that belongs to a different session's domain.
- Branch `feat/spec-contract` is N commits ahead of origin; no push has been authorised by the user.

**What chunk 3 needs**
1. Append decisions `D-12..D-NN` to `.codexian/spec/CONTEXT.phase-4.md` under a new sub-heading "plan-checker blocking gate (chunk 3)". Capture: who runs the checker (architect tier), gate input (CONTEXT + PLAN + ROADMAP phase entry), reject criteria (plan does not actually accomplish phase goal / leaves AC uncovered / proposes scope outside REQUIREMENTS), output shape (verdict + concrete rejection reasons), where the verdict is persisted (probably inline log in PLAN file or new VERIFY-style artifact — decide).
2. Update `skills/spec-plan/SKILL.md` to call the architect-tier reviewer between the `$ralplan` output and the plan-file write. Reject → loop back; approve → write `plans/phase-N.PLAN.md`. Keep `--interactive` and `--deliberate` flags working.
3. Add AC-13..AC-NN matching the new D-IDs.
4. Tests: the gate lives in the skill prompt so unit testing the *code* is limited. Add a code-level test if any new validator hook fires (e.g. "if plan file exists but lacks an architect-approved marker, validate WARNs"). Otherwise rely on smoke test transcripts.

**Don't disturb**
- Other sessions are active in this branch — they've recently added hook-register, exec-wrapper, team-tasks (C2/C3/C4 connection surfaces). Avoid editing `src/spec/hook-register.ts`, `src/spec/exec-wrapper.ts`, `src/spec/team-tasks.ts`, and their tests unless explicitly asked.
- The doctor's `codex hook registration` WARN about missing trust hash belongs to the hook-register session; leave it alone.

**Naming / IDs to use**
- Continue `D-NN` zero-padded scheme; phase 4 already uses D-01..D-11. Start chunk 3 at D-12.
- New AC continues from AC-13.

**Files to expect touching for chunk 3**
- `.codexian/spec/CONTEXT.phase-4.md` (decisions + AC append)
- `skills/spec-plan/SKILL.md` (architect call insertion)
- Possibly `.codexian/spec/plans/phase-4.PLAN.md` (first time phase 4 itself gets a plan — this is also the test of D-04/D-09: gate fires once phase-4 has a plan file, so every D-01..D-NN in CONTEXT.phase-4.md must be cited in the plan file or validate will error)
- Possibly a tiny code change in `src/spec/validate.ts` if you want validate to also surface a "no plan-checker verdict found" warning when a plan file exists but lacks the architect marker.

**Where to read before starting**
1. `.codexian/spec/CONTEXT.phase-4.md` D-01..D-11 (precedent decisions for chunk style)
2. `skills/spec-plan/SKILL.md` (the file you'll edit; already updated with plan-file persistence in chunk 2)
3. `skills/spec-verify/SKILL.md` (mirror pattern — placeholder skill with documented seam)
4. `docs/spec-taxonomy.md` (taxonomy + four-channel teaching pattern, in case you add a new kind)
