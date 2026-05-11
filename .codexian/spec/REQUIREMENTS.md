<!-- SPEC:DOC:REQUIREMENTS -->
<!-- spec:kind: SCOPE -->
<!-- spec:author: human -->
<!-- spec:mutability: mutable -->
<!-- spec:load: always -->
<!-- spec:forcing: yes -->
<!-- schema_version: 1 -->

# REQUIREMENTS

## Functional requirements

- FR-1: `codexian spec init` scaffolds `.codexian/spec/` with the 5 canonical docs, CONTEXT template, session-start hook, and generated/ placeholders.
- FR-2: `codexian spec validate` enforces forcing-function rules, schema versions, and current-phase CONTEXT completeness.
- FR-3: `codexian spec doctor` performs install-integrity checks across files, hook, AGENTS.md heritage, and skills.
- FR-4: `codexian spec seal <N>` snapshots STATE + CONTEXT, append-only ledger; `--advance` flips ROADMAP and bumps current_phase.
- FR-5: `codexian spec init` auto-merges the SPEC:CONTRACT block into project AGENTS.md (opt out via `--no-agents`).
- FR-6: Eight owner skills exist for the 10 DocKinds (some kinds share owners).

## Non-functional requirements

- NFR-1: Session-start hook is stdlib-only Node, silent when no spec dir exists.
- NFR-2: Validator runs in < 200 ms on a project with ~10 phases.
- NFR-3: Touching existing OMX files limited to additive case branches and union extensions (no logic changes).

## Out of scope

- Auto-registering the hook in `.codex/hooks.json` (deferred — Codex upstream hook regression).
- Per-phase plan artifact file separation (plans embedded in ROADMAP markers for v1).
- VERIFY.phase-N.md report artifact generation (skill exists; report file deferred).
- Windows native support (inherits OMX's macOS/Linux primary path).
- npm publishing of the codexian package (manual only, not codified in spec commands).
- Stray-file ERROR escalation (stays WARN — users may extend the spec dir intentionally).

## Dependencies

- Inherits OMX 0.16.4 runtime: Node ≥20, TypeScript 6, biome, zod, @modelcontextprotocol/sdk.
- No new runtime dependencies introduced by the spec contract.

## Risks

- Risk: LLM ignores the AGENTS.md Mandatory directive in long sessions.
  - Mitigation: directive uses strict language ("you are not qualified"); empirical compliance verified in Test 12/13.
- Risk: Spec dir grows beyond context window budget.
  - Mitigation: per-kind sizeBudgetLines, validator WARN on overflow.

## Open questions

- Question: Verify report artifact format — markdown checklist vs structured YAML? — Owner: maintainer — Target: phase 3
- Question: Should `spec seal --advance` be the default after a stable period? — Owner: maintainer — Target: phase 3
