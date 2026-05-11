---
name: spec-patterns
description: Owner skill for the PATTERNS kind — regenerable catalog of recurring code patterns / conventions at .codexian/spec/generated/PATTERNS.md. Placeholder.
---

# Spec Patterns — Pattern Catalog Owner (placeholder)

`$spec-patterns` owns `.codexian/spec/generated/PATTERNS.md` (kind:
PATTERNS). Companion to `$spec-map`: where MAP says *where things
are*, PATTERNS says *how things are done* in this codebase.

## Status

**Placeholder.** The generator agent is not yet implemented. This
SKILL.md exists to anchor the kind in the taxonomy and prevent
ad-hoc hand-edits.

## When implemented, this skill will

1. Sample representative files across the codebase to detect
   recurring patterns:
   - error-handling shape (throw vs result type, where errors get
     caught, what gets logged)
   - state-management idioms (where mutability is allowed, how
     persistence is gated)
   - test conventions (suite layout, fixtures, mocking policy)
   - module boundaries (what crosses, what does not)
   - naming conventions
   - dependency injection / wiring style
2. Produce a digest with concrete short snippets so agents asked to
   add code in this repo will match local conventions, not generic
   "industry standard" patterns.
3. Be regenerable: re-running rebuilds the file. Do not hand-edit.

## Strict rules

- **Regenerable.** Never hand-edit between regenerations.
- **Tied to a commit SHA in the header.** When implemented, the
  generator records the SHA the patterns were sampled from so
  staleness is visible.
- **Do not contradict ROADMAP/REQUIREMENTS.** If a sampled pattern
  conflicts with a stated decision, surface the conflict — do not
  silently teach agents the contradictory pattern.

## Until then

Treat the repository's actual code as the source of truth for
patterns. Use `omx_wiki/` if it carries pattern notes. Do not
create `PATTERNS.md` by hand.
