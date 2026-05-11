<!-- SPEC:DOC:STATE -->
<!-- schema_version: 1 -->

# STATE

> Current position and recent decisions. The *only* file that changes frequently during normal work.
> Workers and humans read this to know "where are we right now."

## Current phase

current_phase: 1

## Last seal

last_sealed_phase: 0
last_sealed_at: _ISO 8601 timestamp, set by `$spec-seal`_

## Active work

<!-- What is being worked on right now. Updated by executors. -->

- _TODO: nothing in flight_

## Recent decisions

<!-- Append-only log of decisions that affect future work. Most recent at top. -->

<!-- 2026-01-01T00:00:00Z — Decided to use X over Y because Z. Affects phases 2–4. -->

## Open blockers

<!-- Things that prevent the current phase from completing. -->

- _TODO_

## Notes

<!-- Anything else workers/humans need to know to pick up from where the previous session left off. -->
