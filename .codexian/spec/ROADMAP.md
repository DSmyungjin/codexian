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

- **Status:** `[~]`
- **Goal:** codexian itself uses its own spec contract. Add unit tests for src/spec/. Verify LLM behavior in real Codex sessions. Introduce Decision ID + coverage gate (D-01..D-05 in CONTEXT.phase-2.md) so plans must reference every CONTEXT decision.
- **Acceptance:** `.codexian/spec/` is committed and validates clean; src/spec/__tests__/ covers init, validate, seal, doctor, agents-merge with positive + negative cases; at least one real Codex session captured demonstrating SPEC:CONTRACT directive compliance; Decision ID + coverage gate implemented in src/spec/decisions.ts and wired into validate.ts; coverage tests under src/spec/__tests__/{decisions,validate}.test.ts pass.
- **Dependencies:** Phase 1
- **Context doc:** `CONTEXT.phase-2.md`

### Phase 3: Codex hook auto-registration

- **Status:** `[ ]`
- **Goal:** When Codex's SessionStart hook regression is resolved upstream, `codexian spec init` auto-registers the session-start.mjs hook in `.codex/hooks.json` and AGENTS.md fallback becomes redundant.
- **Acceptance:** hook entry written, hook fires in fresh Codex session, smoke test confirms behavior; AGENTS.md mandatory directive remains as graceful fallback.
- **Dependencies:** Phase 2; upstream openai/codex hook fix
- **Context doc:** `CONTEXT.phase-3.md`
