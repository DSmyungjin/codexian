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

- **Status:** `[x]`
- **Goal:** `codexian spec init` writes the SessionStart entry to `.codex/hooks.json` AND the matching trust hash to `$CODEX_HOME/config.toml`, so the hook channel works on Codex 0.129+ without the user trusting via TUI `/hooks`. The earlier "upstream regression" framing was incorrect — Codex 0.129's hook trust gate is a security feature, not a bug; codexian satisfies it programmatically.
- **Acceptance:** `spec init` writes hook entry + trust hash; foreign SessionStart entries preserved; idempotent on re-run; doctor reports hook registration state; integration smoke test on Codex 0.130.0 confirms the hook fires and additionalContext reaches the model.
- **Dependencies:** Phase 2
- **Context doc:** `CONTEXT.phase-3.md`

<!-- SPEC:PLAN:START phase-3 -->
Implementation plan for phase 3 (verified empirically against Codex 0.130.0):

- **D-01** (trigger detection) — Codex 0.129+ is detected via `codex --version` semver parse in `src/spec/doctor.ts`. The trust state shape is identical on pre-gate versions and harmless if written, so `registerHook` always writes the trust hash regardless of detected version.
- **D-02** (entry shape) — `.codex/hooks.json` SessionStart entry: `matcher: "startup|resume|clear"`, single command `"node" "<canonical-abs-path-to-.codexian/spec/hooks/session-start.mjs>"`. Status message `"codexian spec session-start"`.
- **D-03** (idempotency) — scan existing SessionStart entries for an exact command match; skip-write when present. `hooks.json` is JSON round-tripped with `JSON.stringify(obj, null, 2)`.
- **D-04** (conflict policy) — never edit or remove a SessionStart entry whose command does not match the codexian script path. Other tools' SessionStart hooks coexist (verified in unit test).
- **D-05** (trust hash) — `sha256(canonicalJson(normalisedIdentity))` matching OMX's `versionForCodexTomlIdentity`. Trust key uses `realpathSync(hooksJsonPath)` to handle macOS `/tmp` → `/private/tmp` symlinks (a real failure mode discovered during testing). Written to `[hooks.state."<key>"] trusted_hash = "sha256:..."` in `$CODEX_HOME/config.toml`.

Self-application: `codexian spec init` ran on this repo writes the entry to `.codex/hooks.json` and the trust hash to `~/.codex/config.toml`. `codexian spec doctor` reports `PASS` for `codex hook registration`. Smoke verified: spec context reaches the model via additionalContext on Codex 0.130.0.

AC coverage:
- AC-1..AC-6 all satisfied. The earlier "upstream-blocked" framing was wrong; `codexian spec doctor` and `docs/codex-hook-trust-gate.md` now describe the actual mechanism.
<!-- SPEC:PLAN:END phase-3 -->


### Phase 4: Validation depth and scope sealing

- **Status:** `[~]`
- **Goal:** Tighten the verify/plan/scope side of the contract while phase 3 is upstream-blocked. Add a verify-failure recording surface that auto-appends fix tasks to STATE.md Active work (mirrors GSD `/gsd-verify-work` fix-plan append). Then split PLAN out of ROADMAP into per-phase plan files. Finally add a plan-checker blocking gate on top of the existing Decision-ID coverage gate so plans are not just D-NN complete but goal-aligned.
- **Acceptance:** `codexian spec record-verify-failure` CLI exists and is wired into `$spec-verify` skill for fail/partial verdicts; STATE.md Active work receives a structured fix-task bullet with root cause + evidence; per-phase plan body lives in `.codexian/spec/plans/phase-N.PLAN.md` (or equivalent), with ROADMAP retaining only a reference; coverage gate continues to fire against the new location; plan-checker blocking gate refuses to mark a phase planned when an architect-tier reviewer disagrees with the plan; unit tests cover the new modules with positive + negative cases.
- **Dependencies:** Phase 2
- **Context doc:** `CONTEXT.phase-4.md`
