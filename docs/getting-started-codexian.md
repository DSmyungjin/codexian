# Getting Started with codexian

A practical walkthrough for using codexian on a **new project**. This is
the answer to *"I've cloned codexian, now what?"*

> **Bin name note.** codexian inherits OMX's CLI binary, so the command
> you actually type is `omx spec ...`, not `codexian spec ...`. The
> upstream OMX surface (`omx team`, `omx ralph`, `omx setup`, etc.) is
> unchanged.

---

## 0. Install (once, globally)

From your codexian checkout:

```bash
cd /path/to/codexian
npm install
npm run build
npm link          # or: npm install -g .
```

`omx` is now on your `$PATH`. One more time:

```bash
omx setup
```

This installs the spec wrapper skills (`$spec-discuss`, `$spec-plan`,
`$spec-seal`, …) under `~/.codex/skills/` so Codex CLI can invoke them
inside a session.

Verify:

```bash
omx version
omx spec --help
```

---

## 1. `omx spec init` in your project

```bash
cd ~/Code/my-new-project
omx spec init
```

A single command does three things at once:

1. **Scaffolds `.codexian/spec/`** — five canonical markdown files
   (`PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`,
   `CONTEXT.template.md`), the `hooks/session-start.mjs` script, and
   `generated/{MAP,PATTERNS}.md` placeholders.
2. **Merges the `SPEC:CONTRACT` block into project-root `AGENTS.md`** —
   Codex auto-loads `AGENTS.md` every session, so the directive
   *"Before producing any output, Read these five files in order"*
   fires every session, every model, every runtime.
3. **Registers the SessionStart hook** — writes an entry to
   `.codex/hooks.json` *and* the matching trust hash to
   `$CODEX_HOME/config.toml`, so the hook fires on Codex 0.129+ without
   any TUI `/hooks` step.

Useful opt-outs:

- `--no-agents` — skip the AGENTS.md merge
- `--no-hook-register` — skip the hooks.json + trust write
- `--no-hook-trust` — write the hooks.json entry but not the trust hash
  (you'll trust manually via TUI `/hooks`)
- `--force` — overwrite an existing scaffold

---

## 2. Fill the three forcing-function docs

This is the only real work of bootstrap. **Order matters**:

### `.codexian/spec/PROJECT.md` (kind: INTENT)

Sections you must fill (no `_TODO_` leftovers — the validator refuses):

- **Vision** — one paragraph: what this project is
- **Non-goals** — what you're explicitly not building (this is the
  more important half)
- **Primary user** — who you're building for
- **Constraints** — technical or organisational limits
- **Success metrics** — concrete bar for "done"

### `.codexian/spec/REQUIREMENTS.md` (kind: SCOPE)

- **Functional requirements** — `FR-1`, `FR-2`, …
- **Non-functional requirements** — `NFR-1`, `NFR-2`, …
- **Out of scope** — items deliberately deferred
- **Dependencies** — what you rely on
- **Risks** — with mitigations
- **Open questions** — with owners + target phase

### `.codexian/spec/ROADMAP.md` (kind: ROADMAP)

Start with just **phase 1**. Each entry needs:

```markdown
### Phase 1: <short name>

- **Status:** `[~]`
- **Goal:** <one paragraph>
- **Acceptance:** <concrete, testable criteria>
- **Dependencies:** none
- **Context doc:** `CONTEXT.phase-1.md`
```

Add more phases later as the roadmap clarifies. The first ROADMAP is
*not* meant to be complete — it's meant to be honest about phase 1 and
leave space for phase 2+.

---

## 3. Validate + doctor

```bash
omx spec validate
```

`OK — no issues.` means all forcing-function docs are spec-complete and
no `_TODO_` placeholder leaked into a required section.

```bash
omx spec doctor
```

Installation integrity check — every line should be `PASS` (or `INFO`).
Common WARNs and what they mean:

- **`codex CLI version` INFO** — your Codex version + whether the
  trust gate is active. Informational only.
- **`codex hook registration` WARN** — `hooks.json` entry exists but
  trust hash is missing. Run `omx spec init --force` to write the hash.
- **`schema_version` WARN** — a doc has an older schema marker. Usually
  safe; back up local edits and run `omx spec init --force`.

---

## 4. First phase work — inside a Codex session

Start a Codex session. The hook + AGENTS.md directive ensure the five
spec files are in context before your first turn.

```
codex
# or to launch via OMX tmux wrapper:
omx
```

In the session, the workflow is three skill invocations:

### `$spec-discuss 1`

A structured interview that fills `CONTEXT.phase-1.md` with **D-NN**
tagged decisions (e.g. `- **D-01** — <body>`). Decisions live inline
in any section; the validator extracts them by regex.

### `$spec-plan 1`

Reads `CONTEXT.phase-1.md` + ROADMAP phase entry, runs the consensus
planner (`$ralplan` under the hood), and writes the approved plan to
`.codexian/spec/plans/phase-1.PLAN.md`. ROADMAP gets a one-line
back-compat marker (`See plans/phase-1.PLAN.md.`).

**Critical rule** — every `D-NN` in CONTEXT must appear at least once
in the plan body. If not, `omx spec validate` will fail with an error
naming the missing IDs. This is the *Decision-ID coverage gate*.

### `$ralph` or `$team`

Actual execution.

- `$ralph "<task>"` — warm-context loop, single leader, runs until
  task is complete + architect-verified.
- `$team N:executor "<task>"` — `N` tmux worker panes coordinating
  through shared state files. Use when work splits cleanly into
  independent lanes.

During work, `STATE.md` is the only spec file you (or the agent)
edit freely. Append to `## Active work` and `## Recent decisions` as
things happen.

When a Ralph run completes, the workflow can shell out to:

```bash
omx spec record-completion <slug> \
  --summary "<one line>" \
  --evidence "<path/to/log>"
```

This clears the slug-matching bullet from `## Active work` and logs a
ledger line under `## Recent decisions` — Ralph progress reaches the
durable POSITION doc.

---

## 5. Seal the phase + advance

When phase 1's acceptance criteria are all satisfied:

```bash
omx spec seal 1 --advance
```

This:

1. Walks acceptance criteria (records pass/fail).
2. Snapshots `STATE.md` + `CONTEXT.phase-1.md` to
   `.codexian/spec/sealed/phase-1.{STATE,CONTEXT}.md` (immutable).
3. Appends one line to `.codexian/spec/sealed/LEDGER.md`.
4. Flips ROADMAP phase 1 to `[x]` and phase 2 (if present) to `[~]`.
5. Bumps STATE.md `current_phase: 2`.

You may want `--strict-active` (refuse seal while ralph/team is live)
or `--ignore-active` (skip the interlock check) depending on the
situation.

Then repeat from step 4 for phase 2.

---

## 6. Handling verify failures

When a phase's verification fails (or partially passes), record the
failure so the next session sees a pending fix task:

```bash
omx spec record-verify-failure <slug> \
  --fix-task "<actionable task title>" \
  --root-cause "<one-line diagnosis>" \
  --evidence "<path/to/VERIFY transcript>"
```

This appends a `- [fix] ...` bullet to `STATE.md ## Active work` and
logs a ledger line to `## Recent decisions`. Idempotent by slug — same
slug twice does not duplicate the bullet, but the ledger gets a fresh
line each time so failure history stays chronological.

Pair this with `$spec-verify` from the skill catalog when running
verification interactively.

---

## Common pitfalls (preempt these)

1. **Typing `codexian spec ...` instead of `omx spec ...`** — the CLI
   binary is `omx` (codexian inherits OMX's bin name).
2. **Leaving `_TODO_` in a required section** — forcing-function docs
   refuse to pass validate with placeholders. Replace or delete.
3. **Phase 1 too large** — phases are 1–2 week chunks at most. Big work
   = multiple phases, each with its own seal.
4. **Skipping `$spec-discuss` and jumping to `$spec-plan`** — the skill
   refuses, but if you bypass it manually you'll get a plan with no
   CONTEXT D-IDs to cover. Coverage gate then no-ops, and the resulting
   plan is unanchored.
5. **Editing sealed files** — anything under `sealed/` is immutable. If
   a seal was wrong, add a corrective phase rather than rewrite history.
6. **PLAN body in ROADMAP** — since phase 4 chunk 2, plans live in
   `plans/phase-N.PLAN.md`. The ROADMAP markers hold only a one-line
   reference. Don't put plan bodies back in ROADMAP.

---

## Five-minute first experience

```bash
mkdir ~/test-codexian && cd ~/test-codexian
git init
omx spec init                              # scaffolds + hook + AGENTS.md
omx spec doctor                            # all PASS expected
$EDITOR .codexian/spec/PROJECT.md          # replace the three _TODO_s
$EDITOR .codexian/spec/REQUIREMENTS.md     # replace placeholders
$EDITOR .codexian/spec/ROADMAP.md          # define phase 1
omx spec validate                          # OK — no issues
codex                                      # spec contract is now wired
> $spec-discuss 1
```

---

## Reference

- [Spec contract walkthrough](./spec-contract.md) — deeper mechanics
- [Spec taxonomy](./spec-taxonomy.md) — 10 doc kinds, four teaching channels
- [Codex hook trust gate](./codex-hook-trust-gate.md) — why the 0.129
  trust write is needed
- Codexian's own self-applied spec — read `.codexian/spec/PROJECT.md`
  and `.codexian/spec/ROADMAP.md` of this repo for a real example
