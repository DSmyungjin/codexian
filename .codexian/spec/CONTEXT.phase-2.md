<!-- SPEC:DOC:CONTEXT -->
<!-- spec:kind: DECISIONS -->
<!-- spec:author: interview -->
<!-- spec:mutability: mutable -->
<!-- spec:load: phase-entry -->
<!-- spec:forcing: yes -->
<!-- schema_version: 1 -->

# CONTEXT — Phase 2: Self-application and verification harness

## Layout / shapes

- `.codexian/spec/` lives at codexian repo root and is committed to the feat/spec-contract branch. AGENTS.md at root is the SPEC:CONTRACT carrier.
- `src/spec/__tests__/*.test.ts` follows the existing OMX test pattern (node --test, registered via dist/scripts/run-test-files.js).
- LLM-behavior verification captures Codex CLI exec sessions into `verify/` under spec dir, naming convention `verify/PHASE-2-RUN-<timestamp>.md`.

## Error handling

- Test failures: standard node --test exit codes; CI red on any failure.
- LLM behavior verification: manual reading of session transcripts; pass/fail recorded in verify/ artifacts.

## Data flow

- Self-application: `codexian spec init` ran at repo root. AGENTS.md at root carries SPEC:CONTRACT. New Codex session → AGENTS.md auto-loads → mandatory directive → LLM reads 5 spec files.
- Test harness: src/spec/__tests__/ exercises each module in tmp dirs, no spillover into the repo's own .codexian/.

## Edge cases

- Validator false positives on docs that *describe* placeholder strings (e.g. CONTEXT.phase-1.md AC-2 originally contained literal `_TODO_` while documenting validator behavior). Mitigation today: reword. Real fix: tighten regex to match only line-anchored placeholders, deferred.
- Self-applied spec dir conflicts with cross-platform CI assumptions: validate must remain pure file ops with no shell dependence.

## Out of scope (for this phase)

- Codex hooks.json auto-registration (phase 3).
- VERIFY.phase-N.md report artifact generation (skill exists; produced report file deferred).
- Property-based tests (phase 3 if scale demands).

## Decisions

Decisions are tagged inline as `**D-NN** — <body>` so they can be cross-referenced from plans and checked for coverage. NN is zero-padded to at least two digits; phases with >99 decisions extend naturally to three or more.

- **D-01** — Decision IDs use the pattern `D-NN` (zero-padded, minimum 2 digits). The validator extracts them with regex `\bD-\d{2,}\b`. IDs may appear anywhere in the CONTEXT body; uniqueness within a phase is required.
- **D-02** — The coverage gate lives inside `codexian spec validate`. It activates when (a) STATE.md declares `current_phase: N`, (b) `CONTEXT.phase-N.md` contains ≥1 D-ID, and (c) ROADMAP.md has a `<!-- SPEC:PLAN:START phase-N -->` / `END` section. No new CLI subcommand.
- **D-03** — Plan body cross-references decisions by inline mention. Any whitespace-bounded occurrence of a D-ID inside the SPEC:PLAN markers counts as coverage — no structured `covers:` header required. Keeps planner output natural.
- **D-04** — Empty or missing plan section is a no-op for the gate. We do not punish phases that have not been planned yet; the gate only fires when a plan exists.
- **D-05** — Severity policy: D-IDs present in CONTEXT but missing from PLAN are validator **errors** (the gate's primary purpose). D-IDs present in PLAN but absent from CONTEXT are **warnings** (likely planner typo or stale reference).

## Acceptance criteria

- AC-1: This file (CONTEXT.phase-2.md) plus updated PROJECT/REQUIREMENTS/ROADMAP/STATE are committed on the feat/spec-contract branch.
- AC-2: `codexian spec validate` returns OK (no errors, WARN allowed) when run at the repo root.
- AC-3: `codexian spec doctor` reports the project AGENTS.md heritage as PASS at the repo root.
- AC-4: At least one real `codex exec` invocation captured demonstrating the LLM read the spec files before producing an answer (transcript saved under verify/ or in commit message).
- AC-5: At least three unit tests exist under src/spec/__tests__/ exercising init, validate, seal — registered with the existing test runner and passing.
- AC-6: Decision ID + coverage gate implemented in `src/spec/decisions.ts` and wired into `src/spec/validate.ts` per D-01 through D-05. Running `codexian spec validate` on a phase whose CONTEXT D-ID is not mentioned in the phase's plan emits a validator error.
- AC-7: Unit tests under `src/spec/__tests__/decisions.test.ts` and `src/spec/__tests__/validate.test.ts` cover positive and negative cases for ID extraction, plan reference extraction, coverage computation, and the validate-side integration. All pass under the existing `npm run test:node` runner.

## Notes for the executor

- The validator regex limitation (`_TODO_` literal in body matches the placeholder pattern) is a known false positive surface; fix can come in phase 2 or be deferred. If reworded, add a comment in the doc explaining the workaround.
- LLM session transcript capture: `codex exec ... 2>&1 | tee verify/PHASE-2-RUN-<ts>.md`. Sanitize for any local paths if shared externally.
