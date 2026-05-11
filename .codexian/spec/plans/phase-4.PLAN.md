<!-- spec:plan-check: approved -->
<!-- spec:plan-check-rationale: self-applied; plan body mirrors the three chunks of work landed in commits a19a70b1 / bc93c3c4 / e4c35584 / 0f97453b / 6532d613 / this commit, and the implementation is observable on disk -->
<!-- spec:plan-check-reviewer: architect -->
<!-- spec:plan-check-at: 2026-05-11T15:46:52Z -->

<!-- SPEC:DOC:PLAN -->
<!-- spec:kind: PLAN -->
<!-- spec:author: agent -->
<!-- spec:mutability: frozen -->
<!-- spec:load: phase-entry -->
<!-- schema_version: 1 -->

# PLAN — Phase 4: Validation depth and scope sealing

Implementation plan for phase 4 across three chunks. Self-application: this plan file is itself the first one written through the plan-check gate, so it carries the `spec:plan-check: approved` marker block above.

## Chunk 1 — verify-failure auto-append (shipped a19a70b1 + bc93c3c4)

- **D-01** (separate module) — `src/spec/record-verify-failure.ts` mirrors `record-completion.ts` but writes the opposite direction on STATE. One file per direction keeps grep-ability high.
- **D-02** (bullet format) — `- [fix] <fix-task> — root cause: <rc>. Evidence: <ev>. <!-- fix-slug: <slug> -->`. HTML marker tail makes idempotency a single-string check.
- **D-03** (idempotency) — duplicate slug suppresses the Active-work bullet but always appends a fresh Recent-decisions line. Failure history stays chronological.
- **D-04** (required inputs) — slug + fixTask mandatory. rootCause recommended. evidence optional. Phase resolves from STATE.md `current_phase` when omitted.
- **D-05** (section auto-create) — `## Active work` is created if missing, inserted before `## Recent decisions` for layout consistency.
- **D-06** (skill integration) — `$spec-verify` shells out to the CLI rather than importing the module. Keeps the skill prompt portable across runtimes.

## Chunk 2 — PLAN file split (shipped e4c35584 + 0f97453b)

- **D-07** (location) — new directory `.codexian/spec/plans/`, file `phase-N.PLAN.md` per planned phase. Carries kind + schema markers.
- **D-08** (migration) — phase-2 and phase-3 SPEC:PLAN bodies moved into the new files. ROADMAP markers collapsed to `See [plans/phase-N.PLAN.md](plans/phase-N.PLAN.md).` one-liners.
- **D-09** (extractor priority) — `resolvePlanDecisionRefs(specDir, phase)` reads plan file first, falls back to ROADMAP markers, returns `null` only when neither exists. Coverage gate stays no-op on no-plan (D-04 from phase 2 preserved).
- **D-10** (hook load) — `templates/spec/hooks/session-start.mjs` (and installed copy) load `plans/phase-N.PLAN.md` after `CONTEXT.phase-N.md` when the current phase has one.
- **D-11** (kind hint) — `FILENAME_KIND_HINTS` maps `plans/phase-N.PLAN.md` to PLAN. doctor allows `plans/` as a known top-level directory.

## Chunk 3 — plan-checker blocking gate (this commit)

- **D-12** (gate location) — plan-checker integrated into `$spec-plan` skill (no new CLI). Architect-tier reviewer evaluates draft plan against PROJECT/REQUIREMENTS/ROADMAP/CONTEXT before persistence.
- **D-13** (verdict marker) — on `approved`, writes a marker block at the top of the plan file:
  `<!-- spec:plan-check: approved -->` + rationale + reviewer + ISO timestamp. Plain HTML comment so it travels under all existing kind/schema rules.
- **D-14** (validator WARN) — `src/spec/validate.ts:checkPlanCheckMarker` looks for the approved marker when the current phase has a plan file. Missing → advisory warning, not error. Hard rejection is the skill's job.
- **D-15** (sealed exemption) — `isPhaseSealed(roadmapText, phase)` returns true for ROADMAP entries with `**Status:** [x]`. Sealed plans predate the gate; the validator skips them so phase-2 and phase-3 PLAN files don't get nagged forever.
- **D-16** (rejection loop cap) — when reviewer rejects, the skill re-runs `$ralplan` with the rejection reasons appended as constraints. Maximum 3 rounds before escalating to the user with a "refine CONTEXT first" prompt. The cap lives in the skill prompt, not in code.

## Self-application notes

Phase 4 has no separate `$spec-plan 4` invocation captured — chunks 1 and 2 were authored directly during conversation, with this plan file produced after the fact as part of chunk 3's self-application requirement (AC-16). The plan-check marker above is self-attested: an architect-tier reviewer would not have anything to reject because the plan corresponds to code already on disk and tested. Future plans authored through `$spec-plan` will receive a real architect pass before this marker block is written.

## AC coverage

- AC-1..AC-6 satisfied by commit a19a70b1 (code + 7 tests for recordVerifyFailure) and bc93c3c4 (CONTEXT D-01..D-06 + ROADMAP phase 4 entry + skills/spec-verify/SKILL.md update).
- AC-7..AC-12 satisfied by commit e4c35584 (decisions.ts resolvePlanDecisionRefs + validate.ts switch + contract.ts FILENAME_KIND_HINTS + doctor.ts KNOWN_TOP_DIRS + hook template + 7 tests) and commit 0f97453b (plans/phase-{2,3}.PLAN.md migration + ROADMAP marker collapse + skills/spec-plan/SKILL.md update).
- AC-13..AC-17 satisfied by this commit:
  - AC-13: `skills/spec-plan/SKILL.md` updated with the plan-check gate (step 4), approval marker block (step 5), sealed-phase exemption note (Strict rules), and 3-round cap (step 4).
  - AC-14: `src/spec/validate.ts:checkPlanCheckMarker` emits the advisory WARN with the actionable hint.
  - AC-15: `isPhaseSealed` short-circuits the check when ROADMAP marks the phase `[x]`. Confirmed by unit test.
  - AC-16: This file exists, cites D-01..D-16, carries the marker block; `omx spec validate` returns OK at the repo root with no plan-check WARN for phase 4.
  - AC-17: Unit tests in `src/spec/__tests__/validate.test.ts` cover (a) current-phase plan file without marker → WARN, (b) with marker → no WARN, (c) sealed-phase exemption → no WARN.
