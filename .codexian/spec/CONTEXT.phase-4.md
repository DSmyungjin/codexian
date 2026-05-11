<!-- SPEC:DOC:CONTEXT -->
<!-- spec:kind: DECISIONS -->
<!-- spec:author: interview -->
<!-- spec:mutability: mutable -->
<!-- spec:load: phase-entry -->
<!-- spec:forcing: yes -->
<!-- schema_version: 1 -->

# CONTEXT — Phase 4: Validation depth and scope sealing

> Phase 4 ships the verify/plan/scope tightening that GSD has and codexian deferred in v1. (Earlier framing said phase 3 was upstream-blocked; that was wrong — phase 3 is sealed as of 2026-05-11T10:50Z.)

## Layout / shapes

- New module `src/spec/record-verify-failure.ts` — mirrors `record-completion.ts` but writes the opposite direction (adds a fix task to `## Active work` instead of removing one).
- New CLI subcommand `codexian spec record-verify-failure <slug> [--root-cause ...] [--fix-task ...] [--phase N] [--evidence p1,p2,...]`, wired through `src/cli/spec.ts` in the same shape as `record-completion`.
- `$spec-verify` skill body extended to call the CLI on `fail` / `partial` verdicts. The skill remains a placeholder for the VERIFY artifact itself; only the fix-task seam is implemented in phase 4.
- (Subsequent phase-4 work — PLAN file split + plan-checker — has its own decisions captured later in this CONTEXT once the first surface is in.)

## Error handling

- Missing spec dir or STATE.md: `RecordVerifyFailureError` (same pattern as `RecordCompletionError`).
- Empty slug or empty `fix-task`: refuse with a clear message; recording a failure without a task title is useless.
- STATE.md missing `## Active work` section: append the section before adding the bullet (so a partially-edited STATE doesn't lose the recording).

## Data flow

- `$spec-verify` runs interactive acceptance walk → on fail/partial → bash call `codexian spec record-verify-failure <slug> --root-cause "<rc>" --fix-task "<task>" --evidence "<verify/PHASE-N-...md>"` → CLI writes STATE.md → next session loads STATE.md via session-start hook → executor sees pending fix bullet and resumes.

## Edge cases

- Re-running verify on the same failing phase: idempotent on bullet by `<!-- fix-slug: <slug> -->` HTML marker. Re-recorded → no duplicate bullet; Recent decisions still appends a new line so the *history* of failures is preserved.
- Multiple independent failures in the same phase: each gets its own slug, each gets its own bullet.
- User manually fixes and clears the bullet before re-verify: that's fine — idempotency only protects against duplicate appends, not against user editing.
- `--phase N` resolves from STATE.md `current_phase` when omitted (same as `record-completion`).

## Out of scope (for this phase)

- VERIFY.phase-N.md artifact file production (still placeholder in `$spec-verify` skill — separate phase).
- PLAN file split out of ROADMAP (covered later in phase 4 — separate D-NN decisions when that work begins).
- plan-checker blocking gate (covered later in phase 4 — separate D-NN decisions when that work begins).

## Decisions

- **D-01** — Separate module `src/spec/record-verify-failure.ts`, not an extension of `record-completion.ts`. Reason: opposite direction on STATE (add vs remove from Active work) and opposite semantics (failure vs success). One file per direction keeps grep-ability high.
- **D-02** — Active-work bullet format: `- [fix] <fix-task> — root cause: <root-cause>. Evidence: <ev1>, <ev2>. <!-- fix-slug: <slug> -->`. The HTML marker tail makes idempotency a single-string check; humans see the natural sentence, the validator/recorder sees the slug.
- **D-03** — Idempotency policy: if a bullet with the same `<!-- fix-slug: <slug> -->` marker already exists in `## Active work`, do not append a duplicate. `## Recent decisions` still gets a fresh ledger line per call (failure history is append-only and chronologically meaningful even when re-run).
- **D-04** — Required inputs: `slug` and `fix-task` are mandatory; `root-cause` is recommended (warn when missing but accept). `evidence` is optional but the skill should always pass the VERIFY transcript path. Phase resolves from STATE.md `current_phase` when omitted.
- **D-05** — Section auto-creation: if STATE.md lacks `## Active work`, the recorder creates the section (inserted before `## Recent decisions` if present, else appended at end). Same defensive pattern as `record-completion` but for the add direction.
- **D-06** — Skill integration shape: `$spec-verify` calls the CLI via shell-out (not a TypeScript import) — keeps the skill prompt portable across runtimes and avoids re-coupling skills to module internals. CLI parity with `record-completion` ensures the same pattern is available to other skills.

### PLAN file split (chunk 2)

- **D-07** — New directory `.codexian/spec/plans/`, one file per planned phase named `phase-N.PLAN.md`. Each file carries `<!-- spec:kind: PLAN -->` and `<!-- schema_version: 1 -->`. ROADMAP no longer hosts plan bodies; it hosts a 1-line reference inside the existing `<!-- SPEC:PLAN:START phase-N -->` / `END` markers so back-compat tooling that already grepped the markers still finds them.
- **D-08** — Migration direction is one-way at this commit: the bodies of the phase-2 and phase-3 SPEC:PLAN sections move into the new files, with the ROADMAP marker body collapsed to `See [phase-N.PLAN.md](plans/phase-N.PLAN.md).`. Phase-1 has no SPEC:PLAN section; no migration needed.
- **D-09** — Extractor priority: `extractPlanDecisionRefs(specDir, phase)` reads `plans/phase-N.PLAN.md` first. If that file exists, its body is the canonical plan source — the ROADMAP marker body is ignored even if present (the 1-line reference would otherwise show up as zero D-IDs anyway). If the plan file does not exist, fall back to the ROADMAP SPEC:PLAN markers (legacy path). Both-absent → returns `null` (gate no-op, D-04 from phase 2 still holds).
- **D-10** — Hook behavior: `templates/spec/hooks/session-start.mjs` (and the installed copy under `.codexian/spec/hooks/`) load `plans/phase-N.PLAN.md` after `CONTEXT.phase-N.md` when both exist. Plan file is `phase-entry` load policy under DOC_KIND_SPECS — its inclusion in the hook matches that policy. Silent skip when absent.
- **D-11** — Validation: `FILENAME_KIND_HINTS` gains an entry mapping `plans/phase-N.PLAN.md` to `PLAN`. PLAN is non-forcing, so empty required sections do not trip the validator. Size budget warning (300 lines) still applies per existing per-kind rules.

### plan-checker blocking gate (chunk 3)

- **D-12** — The plan-checker is **integrated into `$spec-plan`** (not a new CLI subcommand). After `$ralplan` produces a draft plan and before persistence, the skill invokes an architect-tier reviewer with PROJECT/REQUIREMENTS/ROADMAP/CONTEXT.phase-N + the draft plan body. Reviewer produces a verdict: `approved`, or `rejected` with structured reasons. This sits on top of (not instead of) the existing Decision-ID coverage gate.
- **D-13** — Verdict persistence: on `approved`, the skill writes an HTML-comment marker block at the top of `plans/phase-N.PLAN.md`:
  ```
  <!-- spec:plan-check: approved -->
  <!-- spec:plan-check-rationale: <reviewer one-liner> -->
  <!-- spec:plan-check-reviewer: architect -->
  <!-- spec:plan-check-at: <ISO timestamp> -->
  ```
  The marker is a plain comment so it travels with the file under all the existing kind/schema rules.
- **D-14** — Validator behavior: when STATE.md's `current_phase` is N and `plans/phase-N.PLAN.md` exists, the validator looks for the `spec:plan-check: approved` marker. Missing → **WARN** (advisory, not error). Rationale: the gate's hard rejection lives in the skill prompt; validate's job is to *surface* the missing marker so the next agent sees it, not to brick on it.
- **D-15** — Sealed-phase exemption: plan files for phases marked `[x]` in ROADMAP predate this gate. The validator skips the marker check for any phase whose ROADMAP status is `[x]`. So `plans/phase-2.PLAN.md` and `plans/phase-3.PLAN.md` do not get nagged.
- **D-16** — Rejection loop: when reviewer rejects, `$spec-plan` re-runs `$ralplan` with the rejection reasons appended as a planning constraint. Maximum 3 rounds before surfacing the failure to the user with a "the plan and the goal are out of alignment — refine CONTEXT.phase-N.md first or escalate" prompt. The skill prompt enforces this round-cap.

## Acceptance criteria

- AC-1: `src/spec/record-verify-failure.ts` exports `recordVerifyFailure({slug, fixTask, rootCause?, phase?, evidence?})` and `RecordVerifyFailureError`. STATE.md `## Active work` receives a bullet matching D-02 format; `## Recent decisions` receives a fresh ledger line every call.
- AC-2: `codexian spec record-verify-failure <slug> --root-cause "..." --fix-task "..." [--phase N] [--evidence "p1,p2"]` exists in the CLI and produces the same STATE.md mutations as the API.
- AC-3: Idempotency: calling the function twice with the same slug appends one Active-work bullet (D-03), but two Recent-decisions lines.
- AC-4: `skills/spec-verify/SKILL.md` documents the fail/partial → CLI call seam (D-06) so future authors of the skill body know to wire the call when implementing the full VERIFY artifact flow.
- AC-5: Unit tests under `src/spec/__tests__/record-verify-failure.test.ts` cover positive (single failure recorded), idempotency (duplicate slug suppressed in Active work), section-auto-create (missing Active work section), missing STATE.md (error path), and missing/empty slug (error path). Tests pass under `node --test dist/spec/__tests__/record-verify-failure.test.js`.
- AC-6: `codexian spec validate` continues to report OK at repo root after the new surfaces land. The phase-4 CONTEXT D-NN coverage gate sits at no-op until a SPEC:PLAN section (or `plans/phase-4.PLAN.md`) for phase 4 exists.

### PLAN split (chunk 2) acceptance

- AC-7: `.codexian/spec/plans/phase-2.PLAN.md` and `phase-3.PLAN.md` exist, carry kind+schema markers, and hold the body that was inside the corresponding ROADMAP SPEC:PLAN markers before this chunk. ROADMAP marker bodies collapsed to 1-line references.
- AC-8: `extractPlanDecisionRefs(specDir, phase)` reads from the plan file when present, falls back to ROADMAP markers when not, returns `null` only when both surfaces are absent. Existing coverage gate behavior (missing=error, extra=warning, no-plan=no-op) is unchanged from the caller's POV.
- AC-9: `templates/spec/hooks/session-start.mjs` and the installed `.codexian/spec/hooks/session-start.mjs` inject the current-phase PLAN file (when present) as an additional block in the session-start envelope. `phase-entry` load policy is satisfied.
- AC-10: `FILENAME_KIND_HINTS` in `src/spec/contract.ts` maps `plans/phase-N.PLAN.md` to `PLAN`. Validator recognises the file kind; no false positives.
- AC-11: `skills/spec-plan/SKILL.md` describes the new persistence target (plan file) and clarifies that ROADMAP markers receive a 1-line back-compat reference only.
- AC-12: Unit tests cover (a) plan file present takes priority, (b) plan file absent + ROADMAP marker present uses fallback, (c) both absent → null. All pass under `node --test`.

### plan-checker (chunk 3) acceptance

- AC-13: `skills/spec-plan/SKILL.md` describes the architect-approval gate (D-12), the marker block written on approve (D-13), the sealed-phase exemption (D-15), and the rejection loop with the 3-round cap (D-16).
- AC-14: `src/spec/validate.ts` emits a `warning` when STATE's `current_phase` has a plan file at `plans/phase-N.PLAN.md` and the file lacks the `<!-- spec:plan-check: approved -->` marker. The warning includes a hint to run `$spec-plan <N>` again or add the marker manually.
- AC-15: Sealed-phase exemption (D-15) — when a phase's ROADMAP status is `[x]`, the validator does not emit the plan-check marker warning for that phase. Confirmed by unit test.
- AC-16: `.codexian/spec/plans/phase-4.PLAN.md` exists (self-application), cites every D-NN from CONTEXT.phase-4.md (D-01 through D-16), carries the `spec:plan-check: approved` marker block, and `omx spec validate` returns OK with no plan-check WARN for phase 4.
- AC-17: Unit tests cover (a) current-phase plan file without marker → WARN, (b) current-phase plan file with marker → no WARN, (c) sealed-phase plan file without marker → no WARN (exemption). All pass under `node --test`.

## Notes for the executor

- Keep the API surface identical in shape to `record-completion.ts`: same `cwd` resolution, same `locateSpecDir` flow, same error class pattern. Reviewers should be able to read the new file as a near-mirror of the old one.
- The skill update (AC-4) is documentation, not behavior. `$spec-verify` itself remains placeholder until a separate phase implements the full VERIFY.phase-N.md artifact. Phase 4 only adds the fix-task seam the placeholder skill explicitly anticipated ("If fail or partial, append a fix-plan section that $ralph or $team can pick up").
- After the verify-failure surface lands, phase 4 continues with two follow-on chunks: (a) split per-phase PLAN bodies out of ROADMAP, (b) add plan-checker blocking gate on top of the existing Decision-ID coverage gate. Each gets its own CONTEXT decisions block when that work begins.
