<!-- SPEC:DOC:CONTEXT -->
<!-- spec:kind: DECISIONS -->
<!-- spec:author: interview -->
<!-- spec:mutability: mutable -->
<!-- spec:load: phase-entry -->
<!-- spec:forcing: yes -->
<!-- schema_version: 1 -->
<!-- This is a TEMPLATE. Generate one CONTEXT.phase-N.md per phase via `$spec-discuss N`. -->

# CONTEXT — Phase {{N}}: {{phase_name}}

> **For agents reading this file:**
> This is a DECISIONS doc for phase {{N}}. Owner skill: `$spec-discuss`.
> You MUST NOT fabricate decisions. If a section is empty, surface it
> to the user during `$spec-discuss` rather than guessing. Once the
> phase is sealed via `$spec-seal {{N}}`, this file is treated as
> frozen — do not modify after seal even if you discover new
> information. Instead, capture follow-ups in the next phase's CONTEXT.
> Acceptance criteria are the gate that `$spec-seal` walks; they must
> be testable, not aspirational.
> Loaded only when this phase is current; budget ~200 lines.

> Implementation decisions captured *before* planning, after `$spec-discuss`.
> This file feeds directly into the planner and executors. Be specific.

## Layout / shapes

<!-- API shapes, file paths, data structures, UI layouts. The gray areas turned into concrete choices. -->

_TODO_

## Error handling

<!-- How does this phase handle failure? What's user-visible vs swallowed? -->

_TODO_

## Data flow

<!-- How does data move through this phase? Input → transform → output. -->

_TODO_

## Edge cases

<!-- Specific edge cases this phase must handle. -->

- _TODO_

## Out of scope (for this phase)

<!-- Things tempting to include but deliberately deferred. -->

- _TODO_

## Acceptance criteria

<!-- How will we verify this phase is done? Concrete and testable. -->

- _TODO_

## Notes for the executor

<!-- Anything the executor needs that doesn't fit above. -->
