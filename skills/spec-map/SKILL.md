---
name: spec-map
description: Owner skill for the MAP kind — regenerable architecture / codebase map at .codexian/spec/generated/MAP.md. Placeholder until a generator agent ships.
---

# Spec Map — Architecture Map Owner (placeholder)

`$spec-map` owns `.codexian/spec/generated/MAP.md` (kind: MAP).
The intent: a 1–2 page architecture map agents can load on-demand
to orient themselves in a large codebase without re-scanning.

## Status

**Placeholder.** The generator agent is not yet implemented. This
SKILL.md exists today so:

1. The taxonomy in `docs/spec-taxonomy.md` is complete — every kind
   has an owner.
2. `AGENTS.md` can refer to `$spec-map` as the only sanctioned
   editor of MAP.md, preventing ad-hoc edits in the meantime.
3. When the generator is added, the contract is already in place.

## When implemented, this skill will

1. Walk the repository: top-level directories, primary entry points,
   module boundaries, and the dependency graph at module level.
2. Produce `.codexian/spec/generated/MAP.md` containing:
   - A one-paragraph "what this codebase is" summary.
   - A directory tree (depth 2–3) with one-line purpose per node.
   - The handful of files that account for the bulk of complexity
     (so newcomers — including fresh-context agents — know which
     files to read first).
   - Cross-cutting concerns: state management, error handling,
     observability layers, build pipeline.
3. Be regenerable: running the skill again rebuilds the file from
   scratch. Do not hand-edit between regenerations.

## Until then

If `MAP.md` does not exist, fall back to `omx_wiki/` or the
project's README for architectural orientation. Do not write
`MAP.md` by hand — wait for the generator. If the user asks for an
architecture summary today, give it inline rather than persisting
to a file under codexian's typed contract.

## Strict rules (now and after implementation)

- **Regenerable, not hand-edited.** Agents must not write to
  `generated/MAP.md` outside this skill.
- **On-demand load only.** This file is large; the session-start
  hook does not auto-inject it.
- **Stale-tolerant.** A two-week-old MAP is still useful. Regenerate
  on demand or when major directory restructures land.
