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
Implementation plan for phase 2:

- **D-01** (regex) — `DECISION_ID_RE = /\bD-\d{2,}\b/g` in `src/spec/decisions.ts`. Word-bounded so embedded matches are rejected; min 2 digits prevents single-letter collisions.
- **D-02** (gate location) — `checkDecisionCoverage()` lives inside `src/spec/validate.ts`, invoked from the main `validate()` flow after the current-phase CONTEXT check. No new CLI subcommand.
- **D-03** (plan reference style) — `extractPlanDecisionRefs()` scans inline `D-NN` occurrences inside `<!-- SPEC:PLAN:START phase-N -->` / `END` markers. No structured `covers:` header required — natural prose mentions count.
- **D-04** (empty plan no-op) — `extractPlanDecisionRefs()` returns `null` when no plan section exists for the phase, and `checkDecisionCoverage()` short-circuits to `[]`. Unplanned phases are not punished.
- **D-05** (severity) — Missing-from-plan IDs are validator **errors** (gate's primary purpose). Extra-in-plan IDs (typos / stale refs) are **warnings**. Both branches tested in `validate.test.ts`.

Self-application connection (C1 from Ralph/Team analysis):
- `codexian spec record-completion <slug>` CLI primitive — Ralph/Team can shell out at completion to update STATE.md (Recent decisions append + Active work bullet cleanup) without coupling ralph/completion-audit.ts to the spec module.

AC coverage:
- AC-1..AC-5 satisfied by this commit + tests + verify transcripts referenced in STATE.md Recent decisions.
- AC-6 satisfied by `decisions.ts` + `validate.ts checkDecisionCoverage()` (this plan section closes the gate against D-01..D-05).
- AC-7 satisfied by `src/spec/__tests__/{decisions,validate}.test.ts` plus init/seal/record-completion tests — 28/28 passing.
<!-- SPEC:PLAN:END phase-2 -->

### Phase 3: Codex hook auto-registration

- **Status:** `[!]`
- **Goal:** When Codex's SessionStart hook regression is resolved upstream, `codexian spec init` auto-registers the session-start.mjs hook in `.codex/hooks.json` and AGENTS.md fallback becomes redundant.
- **Acceptance:** hook entry written, hook fires in fresh Codex session, smoke test confirms behavior; AGENTS.md mandatory directive remains as graceful fallback.
- **Blocker:** waiting on upstream openai/codex SessionStart hook regression fix. Re-open when upstream signals.
- **Dependencies:** Phase 2; upstream openai/codex hook fix
- **Context doc:** `CONTEXT.phase-3.md`

### Phase 4: Validation depth and scope sealing

- **Status:** `[~]`
- **Goal:** Tighten the verify/plan/scope side of the contract while phase 3 is upstream-blocked. Add a verify-failure recording surface that auto-appends fix tasks to STATE.md Active work (mirrors GSD `/gsd-verify-work` fix-plan append). Then split PLAN out of ROADMAP into per-phase plan files. Finally add a plan-checker blocking gate on top of the existing Decision-ID coverage gate so plans are not just D-NN complete but goal-aligned.
- **Acceptance:** `codexian spec record-verify-failure` CLI exists and is wired into `$spec-verify` skill for fail/partial verdicts; STATE.md Active work receives a structured fix-task bullet with root cause + evidence; per-phase plan body lives in `.codexian/spec/plans/phase-N.PLAN.md` (or equivalent), with ROADMAP retaining only a reference; coverage gate continues to fire against the new location; plan-checker blocking gate refuses to mark a phase planned when an architect-tier reviewer disagrees with the plan; unit tests cover the new modules with positive + negative cases.
- **Dependencies:** Phase 2
- **Context doc:** `CONTEXT.phase-4.md`
