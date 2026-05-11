<!-- SPEC:DOC:PLAN -->
<!-- spec:kind: PLAN -->
<!-- spec:author: agent -->
<!-- spec:mutability: frozen -->
<!-- spec:load: phase-entry -->
<!-- schema_version: 1 -->

# PLAN — Phase 3: Codex hook auto-registration

Implementation plan for phase 3 (verified empirically against Codex 0.130.0):

- **D-01** (trigger detection) — Codex 0.129+ is detected via `codex --version` semver parse in `src/spec/doctor.ts`. The trust state shape is identical on pre-gate versions and harmless if written, so `registerHook` always writes the trust hash regardless of detected version.
- **D-02** (entry shape) — `.codex/hooks.json` SessionStart entry: `matcher: "startup|resume|clear"`, single command `"node" "<canonical-abs-path-to-.codexian/spec/hooks/session-start.mjs>"`. Status message `"codexian spec session-start"`.
- **D-03** (idempotency) — scan existing SessionStart entries for an exact command match; skip-write when present. `hooks.json` is JSON round-tripped with `JSON.stringify(obj, null, 2)`.
- **D-04** (conflict policy) — never edit or remove a SessionStart entry whose command does not match the codexian script path. Other tools' SessionStart hooks coexist (verified in unit test).
- **D-05** (trust hash) — `sha256(canonicalJson(normalisedIdentity))` matching OMX's `versionForCodexTomlIdentity`. Trust key uses `realpathSync(hooksJsonPath)` to handle macOS `/tmp` → `/private/tmp` symlinks (a real failure mode discovered during testing). Written to `[hooks.state."<key>"] trusted_hash = "sha256:..."` in `$CODEX_HOME/config.toml`.

Self-application: `codexian spec init` ran on this repo writes the entry to `.codex/hooks.json` and the trust hash to `~/.codex/config.toml`. `codexian spec doctor` reports `PASS` for `codex hook registration`. Smoke verified: spec context reaches the model via additionalContext on Codex 0.130.0.

AC coverage:
- AC-1..AC-6 all satisfied. The earlier "upstream-blocked" framing was wrong; `codexian spec doctor` and `docs/codex-hook-trust-gate.md` now describe the actual mechanism.
