<!-- SPEC:DOC:CONTEXT -->
<!-- spec:kind: DECISIONS -->
<!-- spec:author: interview -->
<!-- spec:mutability: mutable -->
<!-- spec:load: phase-entry -->
<!-- spec:forcing: yes -->
<!-- schema_version: 1 -->

# CONTEXT — Phase 1: Spec contract foundation

## Layout / shapes

- `src/spec/` for in-process API (contract, locate, init, validate, seal, doctor, agents-merge).
- `templates/spec/` for shipped artifacts (5 canonical .md + CONTEXT.template + hooks/session-start.mjs + generated/{MAP,PATTERNS}.md).
- `src/cli/spec.ts` as subcommand router; one `case "spec"` line in src/cli/index.ts to minimize merge surface.
- `skills/spec-*/` for 8 owner skills covering DECISIONS, PLAN, ROADMAP, POSITION, HISTORY, MAP, PATTERNS, VERIFY.

## Error handling

- Validator emits structured ValidationIssue objects (error/warning), exit 1 on any error.
- Doctor returns DoctorReport with PASS/WARN/FAIL/INFO checks; exit 1 on any FAIL.
- Seal refuses re-seal of an existing phase (immutability discipline), --force opt-in for same-session corrections only.

## Data flow

- spec init: templates/spec/ → cpSync → .codexian/spec/ + mergeAgentsHeritage → AGENTS.md.
- spec inject: locate dir → read 4 always-on + CONTEXT.phase-N → JSON envelope on stdout.
- spec seal: STATE.md + CONTEXT.phase-N → sealed/phase-N.{STATE,CONTEXT}.md → LEDGER append → optional --advance flips ROADMAP and bumps current_phase.

## Edge cases

- Multiple SPEC:CONTRACT marker mentions in template (documentation listing) — line-anchored regex distinguishes real block from text references.
- Last phase --advance — flips status [~]→[x] but leaves current_phase unchanged (prints explicit message).
- Empty spec dir → doctor FAIL on required docs but agents-heritage / skills checks still run.

## Out of scope (for this phase)

- Codex hooks.json auto-registration (Codex 0.130 hook regression; phase 3).
- VERIFY.phase-N.md report artifact (skill present; file generation phase 2/3).
- Unit tests for src/spec/ (phase 2).

## Acceptance criteria

- AC-1: `codexian spec init` creates 8 spec files + merges AGENTS.md SPEC:CONTRACT block, idempotent on re-run.
- AC-2: `codexian spec validate` detects the literal placeholder string in required sections of forcing-function docs, returns exit 1.
- AC-3: `codexian spec seal <N>` snapshots STATE and CONTEXT, refuses re-seal of sealed phase.
- AC-4: `codexian spec seal <N> --advance` flips ROADMAP status N → [x] and N+1 → [~], advances STATE current_phase.
- AC-5: `codexian spec doctor` reports PASS for a clean install, WARN for missing AGENTS.md heritage, FAIL for missing required docs.
- AC-6: 49 end-to-end smoke scenarios across init/validate/seal/doctor/agents-merge/advance/strict-CONTEXT all green.

## Notes for the executor

- Avoid touching `src/team/runtime.ts`, `src/cli/index.ts` (top-level), `src/team/state.ts` beyond necessary union extension for the "spec" command.
- All new code lives in src/spec/, src/cli/spec.ts, skills/spec-*/, templates/spec/, docs/spec-contract.md.
