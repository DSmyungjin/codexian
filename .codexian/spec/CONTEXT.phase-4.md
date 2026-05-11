<!-- SPEC:DOC:CONTEXT -->
<!-- spec:kind: DECISIONS -->
<!-- spec:author: interview -->
<!-- spec:mutability: mutable -->
<!-- spec:load: phase-entry -->
<!-- spec:forcing: yes -->
<!-- schema_version: 1 -->

# CONTEXT — Phase 4: Validation depth and scope sealing

> Phase 4 ships the verify/plan/scope tightening that GSD has and codexian deferred in v1. Phase 3 is `[!]` blocked on upstream Codex hooks; phase 4 progresses in parallel.

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

## Acceptance criteria

- AC-1: `src/spec/record-verify-failure.ts` exports `recordVerifyFailure({slug, fixTask, rootCause?, phase?, evidence?})` and `RecordVerifyFailureError`. STATE.md `## Active work` receives a bullet matching D-02 format; `## Recent decisions` receives a fresh ledger line every call.
- AC-2: `codexian spec record-verify-failure <slug> --root-cause "..." --fix-task "..." [--phase N] [--evidence "p1,p2"]` exists in the CLI and produces the same STATE.md mutations as the API.
- AC-3: Idempotency: calling the function twice with the same slug appends one Active-work bullet (D-03), but two Recent-decisions lines.
- AC-4: `skills/spec-verify/SKILL.md` documents the fail/partial → CLI call seam (D-06) so future authors of the skill body know to wire the call when implementing the full VERIFY artifact flow.
- AC-5: Unit tests under `src/spec/__tests__/record-verify-failure.test.ts` cover positive (single failure recorded), idempotency (duplicate slug suppressed in Active work), section-auto-create (missing Active work section), missing STATE.md (error path), and missing/empty slug (error path). Tests pass under `node --test dist/spec/__tests__/record-verify-failure.test.js`.
- AC-6: `codexian spec validate` continues to report OK at repo root after the new surfaces land. The phase-4 CONTEXT D-NN coverage gate sits at no-op until a SPEC:PLAN section for phase 4 exists in ROADMAP (D-04 from phase 2).

## Notes for the executor

- Keep the API surface identical in shape to `record-completion.ts`: same `cwd` resolution, same `locateSpecDir` flow, same error class pattern. Reviewers should be able to read the new file as a near-mirror of the old one.
- The skill update (AC-4) is documentation, not behavior. `$spec-verify` itself remains placeholder until a separate phase implements the full VERIFY.phase-N.md artifact. Phase 4 only adds the fix-task seam the placeholder skill explicitly anticipated ("If fail or partial, append a fix-plan section that $ralph or $team can pick up").
- After the verify-failure surface lands, phase 4 continues with two follow-on chunks: (a) split per-phase PLAN bodies out of ROADMAP, (b) add plan-checker blocking gate on top of the existing Decision-ID coverage gate. Each gets its own CONTEXT decisions block when that work begins.
