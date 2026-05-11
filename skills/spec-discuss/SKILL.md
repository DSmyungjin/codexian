---
name: spec-discuss
description: Capture phase-level implementation decisions into .codexian/spec/CONTEXT.phase-N.md before planning. Wraps $deep-interview.
---

# Spec Discuss — Phase Decision Capture

`$spec-discuss` is the codexian spec-contract entry into the discuss step
of the GSD-style loop. It runs the same interview you'd get from
`$deep-interview` but with one strict additional rule: **every decision
ends up as a structured edit to `.codexian/spec/CONTEXT.phase-N.md`**.

## Usage

```
$spec-discuss <phase-number> [optional focus prompt]
```

Examples:

```
$spec-discuss 1
$spec-discuss 2 "focus on auth surface and error model"
```

## What this skill does

1. Resolve the spec directory by checking `.codexian/spec/`,
   `.omx/spec/`, and `.spec/` in that order. If none exists, ask the
   user to run `codexian spec init` and stop.
2. Read `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, and `STATE.md`
   into working memory. Identify the phase by its entry in `ROADMAP.md`.
3. If `CONTEXT.phase-N.md` does not yet exist, create it by copying
   `CONTEXT.template.md` (you may also run
   `codexian spec new-phase <N> "<phase name>"` first).
4. Run the `$deep-interview` flow against the user, scoped to phase N.
   Ask only about the gray areas that this phase actually has — do not
   re-litigate things already settled in PROJECT/REQUIREMENTS.
5. After each meaningful answer, append or rewrite the relevant section
   of `CONTEXT.phase-N.md` so that the file always reflects the current
   state of the discussion.
6. When the user signals "we're done" (or when no productive open
   questions remain), summarize the captured decisions and end the
   skill.

## Strict rules

- **Always edit on disk** — every decision must land in
  `CONTEXT.phase-N.md`. Do not hold decisions only in chat memory.
- **Match the template structure** — keep the section headings
  (`## Layout / shapes`, `## Error handling`, …) so the document stays
  machine-parseable.
- **Do not invent decisions** — if the user hasn't decided, write the
  open question with an owner placeholder rather than making something
  up.
- **Do not re-derive PROJECT or REQUIREMENTS** — those live one level
  up. If you find yourself debating scope, stop and tell the user the
  REQUIREMENTS file needs an update first.
- **Do not edit STATE.md from this skill** — that's the executor's job.

## Output for the user

At the end of the session, print:

- Path to the updated `CONTEXT.phase-N.md`
- A 3–7 line summary of the captured decisions
- The next recommended command, typically `$spec-plan <N>`
