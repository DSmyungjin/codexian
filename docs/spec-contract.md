# Spec Contract

The **spec contract** is codexian's documentation-first discipline.
It is the single highest-leverage difference between codexian and
upstream OMX: the project state lives on disk as five canonical
markdown files, every Codex session loads them at startup, and every
workflow step is just a CRUD operation on those files.

## Why

LLM coding sessions are stateless. Without a durable on-disk
representation of *what the project is*, *where it is going*, and
*where it is right now*, every new session re-derives that context
from scratch — and gets it slightly wrong every time. The accumulated
drift is what "context rot" feels like at the user level.

The spec contract pushes that representation out of the model's
context window and onto disk. The window becomes a working surface;
disk becomes memory.

## The five files

All under `.codexian/spec/` (with `.omx/spec/` and `.spec/` as
fallback paths so a project migrating from upstream OMX is not
forced to relocate state).

| File | Role | Mutability |
| --- | --- | --- |
| `PROJECT.md` | Vision, non-goals, primary user, success metrics. The "north star." | Changes rarely. |
| `REQUIREMENTS.md` | Functional + non-functional requirements, out-of-scope items, dependencies, risks, open questions. | Changes when scope changes. |
| `ROADMAP.md` | Ordered list of phases with status, goal, acceptance, dependencies. | Changes at phase boundaries. |
| `STATE.md` | Current position. `current_phase`, last seal, active work, recent-decisions log, blockers. | Changes frequently — the working file. |
| `CONTEXT.phase-N.md` | Per-phase implementation decisions captured by `$spec-discuss`. One per phase, sealed on completion. | Changes during a phase; frozen after seal. |

A template `CONTEXT.template.md` lives alongside; `codexian spec new-phase`
clones it.

## The loop

The workflow is six commands wrapping existing codexian primitives:

```
codexian spec init                 ─── one-time scaffold
↓
$spec-discuss <N>                  ─── populate CONTEXT.phase-N.md
↓
$spec-plan <N>                     ─── approved plan written into ROADMAP.md
↓
$ralph  or  $team                  ─── execute, update STATE.md as you go
↓
$spec-seal <N>                     ─── verify acceptance, snapshot, advance current_phase
↓
$spec-discuss <N+1>                ─── next phase
```

The wrapper skills (`spec-discuss`, `spec-plan`, `spec-seal`) refuse to
fabricate state. If `CONTEXT.phase-N.md` doesn't exist when you ask to
plan, `$spec-plan` will route you back to `$spec-discuss <N>` rather
than guess.

## CLI surface

```
codexian spec init                       Scaffold .codexian/spec/ from templates.
codexian spec validate                   Lint the spec docs.
codexian spec new-phase <N> <name>       Create CONTEXT.phase-N.md.
codexian spec seal <N> [--note ...]      Snapshot STATE + CONTEXT into sealed/.
codexian spec inject                     Print the session-start context block.
codexian spec where                      Print the active spec directory.
```

## How the session-start hook works

`templates/spec/hooks/session-start.mjs` is copied to
`.codexian/spec/hooks/session-start.mjs` by `codexian spec init`. At
session start, the Codex hook runner executes this script; it reads
the four always-on docs plus the `CONTEXT.phase-N.md` matching
`STATE.md`'s `current_phase`, concatenates them into one context
block, and emits the block to stdout. The runner injects stdout into
the session prompt.

The hook is stdlib-only and dependency-free. It is silent (no output)
when no spec directory exists, so it is safe to register globally.

To wire it into Codex, add an entry to `.codex/hooks.json`:

```json
{
  "session_start": [
    {
      "command": "node",
      "args": [".codexian/spec/hooks/session-start.mjs"]
    }
  ]
}
```

(The exact `hooks.json` shape follows Codex's native hook spec; adapt
to the runner version you have installed.)

## Schema markers

Each canonical doc carries machine-readable markers near its top:

```markdown
<!-- SPEC:DOC:PROJECT -->
<!-- schema_version: 1 -->
```

`codexian spec validate` enforces these. If you fork or edit the
templates, keep the markers.

`STATE.md` additionally carries a single required line:

```
current_phase: <N>
```

The session-start hook parses this line to decide which CONTEXT to
load. Removing or renaming it will break context injection.

## Phase sealing

When a phase finishes:

1. `$spec-seal <N>` (or `codexian spec seal <N>`) walks the
   acceptance criteria.
2. On pass, it copies `STATE.md` and `CONTEXT.phase-N.md` into
   `.codexian/spec/sealed/phase-N.{STATE,CONTEXT}.md`.
3. `STATE.md`'s `last_sealed_phase` and `last_sealed_at` advance.
4. An append-only line lands in `.codexian/spec/sealed/LEDGER.md`.
5. `ROADMAP.md`'s phase entry flips to `[x]`.

The sealed snapshots are immutable. If you discover a seal was wrong,
create a corrective phase rather than rewriting history.

## What this does NOT add

The spec contract deliberately stops short of GSD's full enforcement:

- It does **not** force fresh-context-per-task. `$ralph` keeps its
  warm-context throughput advantage. You opt into stricter isolation
  by running a fresh codexian session.
- It does **not** mandate a separate human verify step. `$spec-seal`
  walks acceptance criteria but does not require a UI session.
- It does **not** replace `$ralph`, `$team`, `$ultragoal`, or any
  other existing codexian primitive. It augments them with durable
  documentation.

This is the line we deliberately drew: capture the 80% of the
spec-driven value (durable documentation + phase gates) at 20% of
the operational cost (no forced rebuild on every task, no required
verify interview). For tighter discipline, fork further or layer
custom skills on top.

## FAQ

**Can I rename `.codexian/spec/`?**
Yes — `.omx/spec/` and `.spec/` are recognized fallbacks. To use an
entirely different path, edit the `SPEC_DIR_FALLBACKS` array in
`src/spec/contract.ts` and rebuild.

**Can I add custom files alongside the canonical five?**
Yes. The session-start hook only loads the canonical files plus the
phase-matching CONTEXT, so extras are stored but not auto-injected.
Use them for project-specific knowledge that doesn't fit the schema.

**What if my project predates the contract?**
Run `codexian spec init` and fill the templates from your existing
README, notion docs, or chat history. The contract works as well for
a year-old project as for a fresh one — the value is in *getting the
state onto disk*, not in starting clean.

**How does this interact with `omx_wiki/`?**
They're complementary. `omx_wiki/` is search-first reference knowledge;
the spec contract is workflow-gated state. Wiki tells you "what does
auth look like in this codebase"; spec tells you "we are currently in
phase 3, here is the active context."
