# AGENTS.md

> Project memory for Codex CLI. Codex auto-loads this file at session start.
> The codexian spec-contract block below is managed by `codexian spec init`
> and refreshed by re-running it. Do not edit between the SPEC:CONTRACT
> markers — edit the upstream template and re-run init instead.

<!-- SPEC:CONTRACT:START -->
## codexian spec contract — documentation discipline (always-on rules)

### Mandatory first action — load the spec contract

**Before producing any output to the user, if `.codexian/spec/` (or
`.omx/spec/` or `.spec/`) exists in this project, you MUST use the
Read tool to read these files in order:**

1. `.codexian/spec/PROJECT.md`
2. `.codexian/spec/REQUIREMENTS.md`
3. `.codexian/spec/ROADMAP.md`
4. `.codexian/spec/STATE.md`
5. The `CONTEXT.phase-N.md` matching the `current_phase: N` line in `STATE.md`

These five files are the source of truth for project intent, scope,
trajectory, and current position. **You are not qualified to act in
this project without having read them.** Skipping this step means
working from outdated assumptions and is a hard rule violation.

If none of the candidate directories exist, this project does not
use the spec contract — proceed normally and ignore the rest of this
section.

### Doc kind rules

This project uses a typed documentation contract under
`.codexian/spec/` (fallbacks: `.omx/spec/`, `.spec/`). Every doc has a
**kind** declared via `<!-- spec:kind: X -->` near its top, and each
kind has explicit rules. **Apply these rules in every action.**

| Kind       | Author    | Mutability     | Touch when …                                |
|------------|-----------|----------------|---------------------------------------------|
| INTENT     | human     | mutable        | only the human asks; never silently rewrite |
| SCOPE      | human     | mutable        | only when scope change is approved          |
| ROADMAP    | interview | mutable        | at phase boundaries only (`$spec-roadmap`)  |
| POSITION   | executor  | mutable        | freely, during work — but NOT `last_sealed_*` or the `current_phase:` line format |
| DECISIONS  | interview | mutable→frozen | only during `$spec-discuss N`; frozen after seal |
| PLAN       | agent     | frozen         | only during `$spec-plan N`                  |
| MAP        | agent     | regenerable    | only via `$spec-map` (do not hand-edit)     |
| PATTERNS   | agent     | regenerable    | only via `$spec-patterns`                   |
| HISTORY    | system    | append-only    | only via `codexian spec seal`; sealed files are immutable |
| VERIFY     | agent     | frozen         | only during `$spec-verify`                  |

**Default rule.** If a file in `.codexian/spec/` carries
`<!-- spec:kind: X -->` and you are NOT running the skill that owns
kind X, do not edit it. The only doc you may freely edit during normal
coding work is `STATE.md` (kind POSITION). Append entries; do not
rewrite history.

**Forcing-function docs** (INTENT, SCOPE, ROADMAP, DECISIONS): empty
required sections or `_TODO_` placeholders are validation errors.
When the user has not made a decision, surface it as an open question
rather than fabricating a plausible answer.

**Sealed phases are immutable.** Files under
`.codexian/spec/sealed/` are append-only as a directory and frozen
per-file. To correct a sealed seal, propose a new corrective phase;
never rewrite a sealed snapshot.

**Owner skills.** Updates of each non-trivial kind go through the
named owner skill:
`$spec-discuss` (DECISIONS), `$spec-plan` (PLAN), `$spec-seal`
(HISTORY transitions + ROADMAP status flip), `$spec-roadmap` (ROADMAP
phase changes), `$spec-state-update` (POSITION non-trivial edits),
`$spec-map` (MAP), `$spec-patterns` (PATTERNS), `$spec-verify`
(VERIFY).

For the full taxonomy and rationale, see `docs/spec-taxonomy.md`.
<!-- SPEC:CONTRACT:END -->
