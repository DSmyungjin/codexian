# Codex CLI hook trust gate (Codex 0.129+)

> Previously this document described "the Codex hook regression." That framing
> was wrong. Codex 0.129 added a deliberate security trust gate for hook
> dispatch — a feature, not a bug. The dispatcher refuses to invoke any
> SessionStart / PreToolUse / Stop / etc. hook whose entry has not been
> trusted. Trust is per `(hooks.json path, event, group index, handler index)`
> and stored as a SHA-256 of the canonicalised hook identity. Interactive TUI
> users trust via `/hooks`. `codex exec` non-interactive users used to have
> no surface — codexian now writes the trust state on their behalf during
> `codexian spec init`.

## Mechanism

The trust state lives in `$CODEX_HOME/config.toml` (default `~/.codex/config.toml`)
under sections of the shape:

```toml
[hooks.state."<canonical-hooks-json-path>:<event_label>:<group_idx>:<handler_idx>"]
trusted_hash = "sha256:<hex>"
```

Where:

- `<canonical-hooks-json-path>` is the *resolved* absolute path of `.codex/hooks.json`.
  Symlinks must be resolved: on macOS `/tmp/foo` resolves to `/private/tmp/foo`, and
  the trust key must match the resolved form or the dispatcher will not find it.
- `<event_label>` is the lowercase snake form of the event: `session_start`,
  `pre_tool_use`, `post_tool_use`, `user_prompt_submit`, `pre_compact`,
  `post_compact`, `stop`.
- `<group_idx>` / `<handler_idx>` count which entry inside the JSON `SessionStart`
  array (and which command inside its `hooks` sublist).
- `trusted_hash` is `sha256(canonicalJson(normalisedIdentity))` where the
  normalised identity is:

  ```json
  {
    "event_name": "<event_label>",
    "matcher": "<matcher>",            // omitted when no matcher
    "hooks": [{
      "type": "command",
      "command": "<command string>",
      "timeout": <max(1, t ?? 600)>,
      "async": false,
      "statusMessage": "<msg>"          // omitted when no statusMessage
    }]
  }
  ```

  Keys are sorted before serialisation; `JSON.stringify(canonicalised)` is the
  exact byte string fed to SHA-256.

## How codexian uses it

`codexian spec init` (which runs by default — `--no-hook-register` opts out):

1. Resolves the canonical project root via `fs.realpathSync`.
2. Builds the hook command: `"node" "<canonical-abs-path-to-.codexian/spec/hooks/session-start.mjs>"`.
3. Loads `<project>/.codex/hooks.json` (creating the directory if needed),
   appends a SessionStart entry with `matcher: "startup|resume|clear"` if it
   is not already present. Existing foreign SessionStart entries (other tools'
   hooks) are preserved byte-for-byte.
4. Computes the trust hash for the new entry.
5. Loads `$CODEX_HOME/config.toml`, appends or refreshes the matching
   `[hooks.state."<key>"]` section with `trusted_hash = "sha256:..."`.

After this single call the hook fires on every subsequent `codex exec` /
`codex` session in that project.

## Verification

3-version reproducible smoke (run from `/tmp`):

```bash
mkdir -p /tmp/codex-old   && cd /tmp/codex-old   && npm init -y >/dev/null && npm install @openai/codex@0.128.0
mkdir -p /tmp/codex-newest && cd /tmp/codex-newest && npm init -y >/dev/null && npm install @openai/codex@0.131.0-alpha.4

# In a project where `codexian spec init` has run:
rm -f /tmp/cx-hook-fired.log
codex exec --skip-git-repo-check --enable hooks -C . -s read-only \
  --dangerously-bypass-approvals-and-sandbox \
  "Find UNIQUE_PROJECT_HOOK_MARKER_ in your context." < /dev/null
ls /tmp/cx-hook-fired.log                            # should exist
```

| Codex CLI | Hook fires (auto-trust) | Side-effect file |
|---|---|---|
| 0.128.0 | yes (no gate to begin with) | yes |
| 0.130.0 | yes (trust hash matches) | yes |
| 0.131.0-alpha.4 | yes (same) | yes |

The earlier failure was simply that the test project's hook entry was untrusted —
identical setup with the trust hash written produces consistent firing across
the version range.

## Doctor

`codexian spec doctor` exposes two related checks:

```
[INFO] codex CLI version: 0.130.0 — hook trust gate active (Codex 0.129+).
       codexian spec init writes the trust hash, so hooks fire.
[PASS] codex hook registration: <hooks.json> entry + trust hash in <config.toml>
       — hook channel active
```

Possible outcomes for the registration check:

- **PASS**: hooks.json has the codexian SessionStart entry and `config.toml`
  has a matching trust state.
- **WARN — no hooks.json**: run `codexian spec init`.
- **WARN — no codexian entry**: hooks.json exists but doesn't reference
  `.codexian/spec/hooks/session-start.mjs`. Run `codexian spec init --force`
  to add it (other entries preserved).
- **WARN — no trust state**: hooks.json has the entry but `config.toml`
  doesn't have the trust hash. On Codex 0.129+ the hook will not fire until
  trusted. Either re-run `codexian spec init` or trust via TUI `/hooks`.
- **FAIL — hooks.json invalid**: malformed JSON, hook system refuses to fire
  anything. Fix or remove the file.

## Decision matrix for users

| If you ... | What happens |
|---|---|
| use codexian on Codex 0.128.0 | hook fires (no gate); trust write is harmless no-op |
| use codexian on Codex 0.129+ | hook fires automatically after `codexian spec init` |
| install Codex without codexian | hook does not fire until you trust via TUI `/hooks` |
| install codexian but pass `--no-hook-register` | hook does not fire; spec contract still loads via AGENTS.md mandatory directive |
| install codexian but pass `--no-hook-trust` | hook entry written but not trusted; works on 0.128, blocked on 0.129+ until you trust via TUI |

## Caveats

- Trust hash is path-sensitive: moving the project (or the spec hook script
  within it) changes the canonical path, invalidates the trust key, and the
  hook stops firing until `codexian spec init --force` re-registers.
- Trust hash is command-sensitive: editing the hook command shape (timeout,
  statusMessage, matcher) changes the hash. `codexian spec init` always
  emits the canonical command, so the hash stays stable across reruns.
- We do not touch foreign entries in `.codex/hooks.json`. Other tools that
  manage their own SessionStart hooks coexist.

## Tracking

- Upstream context: [openai/codex#21639](https://github.com/openai/codex/issues/21639)
  (filed as a regression report; the linked thread eventually clarifies
  the trust-gate design).
- codexian implementation: `src/spec/hook-register.ts` →
  `computeTrustHash()` + `registerHook()`.
- Doctor check: `src/spec/doctor.ts` → `checkHookRegistration()`.
- Init wire: `src/spec/init.ts` → calls `registerHook()` after AGENTS.md merge.
