<!-- SPEC:DOC:ROADMAP -->
<!-- spec:kind: ROADMAP -->
<!-- spec:author: interview -->
<!-- spec:mutability: mutable -->
<!-- spec:load: always -->
<!-- spec:forcing: yes -->
<!-- schema_version: 1 -->

# ROADMAP

## Status legend

- `[ ]` not started
- `[~]` in progress
- `[x]` completed and sealed
- `[!]` blocked

## Phases

### Phase 1: Spec contract foundation

- **Status:** `[x]`
- **Goal:** Build the typed documentation contract on top of OMX: templates, CLI surface, validator, doctor, taxonomy, owner skills, AGENTS.md heritage, --advance seal.
- **Acceptance:** spec init/validate/seal/doctor work end-to-end; 8 owner skills exist; AGENTS.md SPEC:CONTRACT block auto-merges; ~49 smoke scenarios pass.
- **Dependencies:** none
- **Context doc:** `CONTEXT.phase-1.md`

### Phase 2: Self-application and verification harness

- **Status:** `[x]`
- **Goal:** codexian itself uses its own spec contract. Add unit tests for src/spec/. Verify LLM behavior in real Codex sessions. Introduce Decision ID + coverage gate (D-01..D-05 in CONTEXT.phase-2.md) so plans must reference every CONTEXT decision.
- **Acceptance:** `.codexian/spec/` is committed and validates clean; src/spec/__tests__/ covers init, validate, seal, doctor, agents-merge with positive + negative cases; at least one real Codex session captured demonstrating SPEC:CONTRACT directive compliance; Decision ID + coverage gate implemented in src/spec/decisions.ts and wired into validate.ts; coverage tests under src/spec/__tests__/{decisions,validate}.test.ts pass.
- **Dependencies:** Phase 1
- **Context doc:** `CONTEXT.phase-2.md`

<!-- SPEC:PLAN:START phase-2 -->
See [plans/phase-2.PLAN.md](plans/phase-2.PLAN.md). (Plan body moved out of ROADMAP in phase 4 chunk 2.)
<!-- SPEC:PLAN:END phase-2 -->

### Phase 3: Codex hook auto-registration

- **Status:** `[x]`
- **Goal:** `codexian spec init` writes the SessionStart entry to `.codex/hooks.json` AND the matching trust hash to `$CODEX_HOME/config.toml`, so the hook channel works on Codex 0.129+ without the user trusting via TUI `/hooks`. The earlier "upstream regression" framing was incorrect — Codex 0.129's hook trust gate is a security feature, not a bug; codexian satisfies it programmatically.
- **Acceptance:** `spec init` writes hook entry + trust hash; foreign SessionStart entries preserved; idempotent on re-run; doctor reports hook registration state; integration smoke test on Codex 0.130.0 confirms the hook fires and additionalContext reaches the model.
- **Dependencies:** Phase 2
- **Context doc:** `CONTEXT.phase-3.md`

<!-- SPEC:PLAN:START phase-3 -->
See [plans/phase-3.PLAN.md](plans/phase-3.PLAN.md). (Plan body moved out of ROADMAP in phase 4 chunk 2.)
<!-- SPEC:PLAN:END phase-3 -->


### Phase 4: Validation depth and scope sealing

- **Status:** `[~]`
- **Goal:** Tighten the verify/plan/scope side of the contract. Chunk 1 (done): verify-failure recording surface that auto-appends fix tasks to STATE.md Active work (mirrors GSD `/gsd-verify-work` fix-plan append). Chunk 2: split PLAN out of ROADMAP into per-phase plan files under `.codexian/spec/plans/`. Chunk 3: plan-checker blocking gate on top of the existing Decision-ID coverage gate so plans are not just D-NN complete but goal-aligned.
- **Acceptance:** `codexian spec record-verify-failure` CLI exists and is wired into `$spec-verify` skill for fail/partial verdicts; STATE.md Active work receives a structured fix-task bullet with root cause + evidence; per-phase plan body lives in `.codexian/spec/plans/phase-N.PLAN.md` (or equivalent), with ROADMAP retaining only a reference; coverage gate continues to fire against the new location; plan-checker blocking gate refuses to mark a phase planned when an architect-tier reviewer disagrees with the plan; unit tests cover the new modules with positive + negative cases.
- **Dependencies:** Phase 2
- **Context doc:** `CONTEXT.phase-4.md`
