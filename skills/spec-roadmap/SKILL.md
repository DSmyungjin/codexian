---
name: spec-roadmap
description: Owner skill for the ROADMAP kind. Handles adding, reordering, and renaming phases in .codexian/spec/ROADMAP.md. Status flips are NOT this skill — those belong to seal.
---

# Spec Roadmap — Phase Structure Owner

`$spec-roadmap` is the only sanctioned way to modify the *structure*
of `.codexian/spec/ROADMAP.md`: adding a new phase, removing one,
reordering, or renaming. Status-marker flips (`[ ] → [~] → [x]`) are
*not* this skill's job — those happen as natural side effects of
work and `$spec-seal`.

## Usage

```
$spec-roadmap                          interactive: walks current roadmap, asks what to change
$spec-roadmap add <position> <name>    add a phase at <position> with <name>
$spec-roadmap move <from> <to>         reorder
$spec-roadmap rename <N> <new-name>    rename phase N
$spec-roadmap remove <N>               delete phase N (only if not yet sealed)
```

## What this skill does

1. Locate the spec dir. Refuse if missing.
2. Read `PROJECT.md`, `REQUIREMENTS.md`, and `ROADMAP.md` into
   context. Phases must be consistent with INTENT and SCOPE.
3. For interactive mode: print the current phase list with their
   statuses and ask the user what to change. For explicit
   subcommands: apply the requested change.
4. Validate the change before persisting:
   - A new phase must declare goal, acceptance, dependencies.
   - Reordering may not place a phase before its dependencies.
   - Removal is refused if `ROADMAP.md` marks the phase as `[~]`
     (in progress) or `[x]` (sealed).
5. Update `ROADMAP.md`. If a phase number shifts, also rename any
   existing `CONTEXT.phase-N.md` file consistently.
6. Append a recent-decisions entry to `STATE.md` describing the
   roadmap change with an ISO 8601 timestamp.

## Strict rules

- **Sealed phases are immutable** — never renumber or remove a phase
  whose status is `[x]`. If the user insists, refuse and recommend
  adding a corrective phase instead.
- **Do not edit phase entries except for structure.** Plan content
  inside `<!-- SPEC:PLAN:START phase-N -->` markers belongs to
  `$spec-plan`. Acceptance criteria belong to `$spec-discuss`.
- **One change per invocation.** If the user asks for multiple
  structural changes, do them one at a time so each lands as its own
  diff in `ROADMAP.md` history.
- **Do not invent phase goals.** When adding a phase, require the
  user to state the goal in their own words; do not auto-generate
  from PROJECT/REQUIREMENTS.

## Failure modes

- Phase has `[~]` status and a removal is requested → refuse.
- Reordering would violate stated dependencies → refuse and explain
  which dependency is broken.
- ROADMAP has no `## Phases` section → refuse and route the user to
  `codexian spec init --force` or manual repair.
