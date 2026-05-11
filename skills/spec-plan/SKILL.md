---
name: spec-plan
description: Turn approved CONTEXT.phase-N.md into a verified implementation plan, updating ROADMAP and STATE. Wraps $ralplan.
---

# Spec Plan — Spec-Driven Planning

`$spec-plan` is the codexian spec-contract entry into the plan step.
It uses the same consensus planning loop as `$ralplan` (Planner →
Architect → Critic), but the inputs and outputs are *files in the
spec directory*, not free-floating chat.

## Usage

```
$spec-plan <phase-number> [--interactive] [--deliberate]
```

## What this skill does

1. Locate the spec dir. Refuse and exit if it doesn't exist.
2. Read `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`,
   and `CONTEXT.phase-N.md`. If `CONTEXT.phase-N.md` is missing or
   still has unresolved `_TODO_` placeholders in critical sections,
   stop and ask the user to run `$spec-discuss <N>` first.
3. Call the underlying `$ralplan` workflow with the loaded documents
   as context. The planning input is:
   - The phase entry in `ROADMAP.md` (goal, acceptance, dependencies)
   - All decisions in `CONTEXT.phase-N.md`
   - Any constraints inherited from `PROJECT.md` and `REQUIREMENTS.md`
4. When `$ralplan` produces an approved plan, persist it:
   - Write the plan body to `.codexian/spec/plans/phase-N.PLAN.md`
     (canonical location since phase 4 chunk 2). Include kind +
     schema markers at the top:
     ```
     <!-- SPEC:DOC:PLAN -->
     <!-- spec:kind: PLAN -->
     <!-- spec:author: agent -->
     <!-- spec:mutability: frozen -->
     <!-- spec:load: phase-entry -->
     <!-- schema_version: 1 -->
     ```
   - Ensure each `D-NN` listed in `CONTEXT.phase-N.md` appears at
     least once in the plan body — the validator's coverage gate
     will refuse with an error otherwise.
   - In `ROADMAP.md`, leave the phase entry intact and place a
     1-line reference inside the existing
     `<!-- SPEC:PLAN:START phase-N -->` / `END` markers:
     `See [plans/phase-N.PLAN.md](plans/phase-N.PLAN.md).`. Insert
     the markers if missing. The marker block is back-compat for
     tooling that grepped the ROADMAP plan section before phase 4.
   - Update `STATE.md`:
     - `current_phase` stays at N
     - Append a line to `## Recent decisions` recording the
       plan-approval moment.
5. Print the path to the updated ROADMAP and STATE plus the
   recommended next command (typically `$ralph` or `$team` against
   the freshly planned phase).

## Strict rules

- **Refuse to plan without a CONTEXT file.** Spec-driven means the
  decisions exist on disk *before* the plan. Skipping `$spec-discuss`
  is the most common failure mode and yields plans that drift from
  user intent.
- **The plan file is the canonical artifact.** Write
  `plans/phase-N.PLAN.md`; the ROADMAP marker block holds only a
  1-line back-compat reference. Do not create plan files outside
  `.codexian/spec/plans/` and do not put plan bodies back into
  ROADMAP markers.
- **Do not modify CONTEXT.phase-N.md** from this skill. Plans
  consume context; they don't rewrite it. If the planning loop
  surfaces a new decision, surface that to the user and recommend
  re-running `$spec-discuss <N>` for the addition.

## Flags passed through to $ralplan

- `--interactive` — ask the user at key decision points
- `--deliberate` — force deliberate (high-risk) mode

## Failure modes to handle explicitly

- `STATE.md current_phase != N` — warn that the user is planning a
  non-current phase and confirm before proceeding.
- Critical CONTEXT sections empty — refuse and route to `$spec-discuss`.
- `ROADMAP.md` has no entry for phase N — refuse and tell the user
  to add the phase to the roadmap first.
