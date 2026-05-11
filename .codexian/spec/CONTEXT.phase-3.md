<!-- SPEC:DOC:CONTEXT -->
<!-- spec:kind: DECISIONS -->
<!-- spec:author: interview -->
<!-- spec:mutability: mutable -->
<!-- spec:load: phase-entry -->
<!-- spec:forcing: yes -->
<!-- schema_version: 1 -->

# CONTEXT — Phase 3: Codex hook auto-registration

> Phase 3 is *gated on upstream*. It cannot ship until OpenAI Codex CLI restores
> the SessionStart hook firing behaviour. Until then the AGENTS.md mandatory-first-action
> directive (committed in phase 1) is the canonical injection channel.
>
> **Verification record**: see [`docs/codex-hook-regression.md`](../../docs/codex-hook-regression.md)
> for the 3-version reproduction proving hooks fire on 0.128.0 but not on
> 0.130.0 / 0.131.0-alpha.4. `codexian spec doctor` now surfaces the regression
> automatically via `checkCodexVersion()` so users never silently fall back
> to AGENTS.md-only operation.

## Layout / shapes

- `.codex/hooks.json` schema follows the Codex hook protocol (one entry per event
  type with `command` + `args`). Phase 3 writes a single SessionStart entry whose
  args point at `.codexian/spec/hooks/session-start.mjs`.
- Hook idempotency: if a SessionStart entry already references the codexian hook
  path, do not duplicate. If a foreign SessionStart entry exists, leave it and
  append rather than rewrite.
- Decision: `codexian spec init` is the writer. `codexian spec uninstall` (future)
  would remove the entry.

## Error handling

- Codex CLI version detection: skip with a printed notice if Codex's hook regression
  is still active in the user's installed CLI version (probe via `codex --version`
  or a marker file when upstream lands the fix).
- Existing `.codex/hooks.json` malformed → refuse to rewrite; print a doctor-style
  diagnostic.

## Data flow

- spec init → if Codex hook system known-good → write SessionStart entry under
  `.codex/hooks.json` → AGENTS.md mandatory directive becomes redundant fallback,
  not the primary load channel.

## Edge cases

- User has manually installed a SessionStart hook for a different tool. We
  preserve it.
- User has the broken Codex CLI version. We skip and print "fallback to AGENTS.md
  active".
- Hook script is unexecutable (lost +x). Doctor already catches this in phase 1.

## Out of scope (for this phase)

- VERIFY.phase-N.md report artifact (deferred again — separate phase).
- C2/C3/C4 connection surfaces from the Ralph/Team analysis. Phase 3 stays focused
  on the hook restoration.

## Decisions

- **D-01** — Trigger condition for hook registration: presence of a non-broken
  Codex CLI version. Mechanism: check a known upstream marker (e.g. file in
  `~/.codex/` or `codex --features hooks`) added by the future Codex release.
- **D-02** — Entry shape: single `SessionStart` entry, `command: "node"`, `args:
  [".codexian/spec/hooks/session-start.mjs"]`. CWD assumed to be project root.
- **D-03** — Idempotency: scan existing entries; skip write if a SessionStart
  command matches our path exactly. Append otherwise.
- **D-04** — Conflict policy: never rewrite or remove a non-codexian SessionStart
  entry. Other tools' hooks coexist.
- **D-05** — Fallback semantics: AGENTS.md mandatory directive stays in place
  permanently — it is cheap, idempotent, and protective when the hook system
  later regresses again.

## Acceptance criteria

- AC-1: `codexian spec init` writes a SessionStart entry to `.codex/hooks.json`
  pointing at `.codexian/spec/hooks/session-start.mjs` when the local Codex CLI
  is detected as hook-capable.
- AC-2: `codexian spec init --no-hook-register` flag exists for users who want
  to opt out (mirrors `--no-agents`).
- AC-3: Re-running `spec init` does not duplicate the entry.
- AC-4: Non-codexian SessionStart entries in `.codex/hooks.json` are preserved
  byte-for-byte (existing user config respected).
- AC-5: Doctor reports the hook registration state (registered / not-registered /
  hook-system-not-detected).
- AC-6: Integration smoke test confirms the hook actually fires in a fresh Codex
  session and injects the spec-contract context block (replicate the Test 12/13
  pattern but with hook channel instead of AGENTS.md channel).

## Notes for the executor

- Wait for Codex upstream signal before implementing AC-1's trigger condition.
- Until then, leave Phase 3 in `[~]` and rely on AGENTS.md (phase 1 commit
  1e72fb14) as the sole injection channel.
- The `templates/spec/hooks/session-start.mjs` already emits the Codex JSON
  envelope (`hookSpecificOutput.additionalContext`), so the script side is
  ready — only registration is gated.
