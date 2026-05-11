<!-- SPEC:DOC:PROJECT -->
<!-- spec:kind: INTENT -->
<!-- spec:author: human -->
<!-- spec:mutability: mutable -->
<!-- spec:load: always -->
<!-- spec:forcing: yes -->
<!-- schema_version: 1 -->

# PROJECT

## Vision

codexian is a hard fork of oh-my-codex that adds a GSD-style typed
documentation contract on top of OMX's runtime orchestration. The
goal is to make Codex CLI sessions resume from durable on-disk
state instead of re-deriving project context from scratch each
session, while preserving OMX's throughput-oriented $ralph / $team
workflow.

## Non-goals

- Not a replacement for OMX. codexian augments; it does not strip.
- Not a one-size-fits-all spec system. Stays optional and opt-out.
- Will not enforce GSD-level fresh-context-per-task. $ralph stays warm.
- Will not auto-publish to npm registry from `spec` commands.

## Primary user

Solo / small-team Codex CLI users who want their project memory to
survive session boundaries and reach new sessions / new collaborators
intact, without giving up OMX's tmux+worktree orchestration.

## Constraints

- Single TypeScript codebase (no new Rust crates for spec contract).
- Standard-library-only for the session-start hook (no extra deps).
- Touch existing OMX hot files (`src/team/runtime.ts`, `src/cli/index.ts`,
  `src/cli/setup.ts`) as minimally as possible to keep upstream
  cherry-picks tractable.

## Success metrics

- A new Codex session can resume from `.codexian/spec/*.md` alone and
  produce work consistent with prior phase decisions.
- spec contract overhead at session start: < 5 KB tokens injected.
- spec init → first useful spec'd phase: < 10 minutes for a new user.
