<!-- SPEC:DOC:PLAN -->
<!-- spec:kind: PLAN -->
<!-- spec:author: agent -->
<!-- spec:mutability: frozen -->
<!-- spec:load: phase-entry -->
<!-- schema_version: 1 -->

# PLAN — Phase 2: Self-application and verification harness

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
