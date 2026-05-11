# Spec Taxonomy — The Typed Documentation Discipline

This file is **codexian's documentation constitution**. It defines the kinds
of documents the project recognizes, what rules each kind obeys, and how
agents are expected to treat each one.

If you are reading this as an agent, the rules below are loaded into
your context at session start via `templates/AGENTS.md`'s
`<!-- SPEC:CONTRACT:START -->` block. The full table here is the
canonical source; the AGENTS.md insert is a summary.

## Why a taxonomy and not just five files

The five canonical files (`PROJECT`, `REQUIREMENTS`, `ROADMAP`, `STATE`,
`CONTEXT`) are the spine, but the *real* contribution of GSD-style
documentation discipline is the *decision matrix* sitting behind them:
who writes each doc, when it changes, what enforces it. Without that
matrix every documentation question becomes a fresh argument.

The taxonomy below freezes those decisions once.

## The ten kinds

| Kind        | Author    | Mutability   | Lifecycle  | Load policy   | Forcing? | Owner skill          |
|-------------|-----------|--------------|------------|---------------|----------|----------------------|
| INTENT      | human     | mutable      | project    | always        | yes      | —                    |
| SCOPE       | human     | mutable      | project    | always        | yes      | —                    |
| ROADMAP     | interview | mutable      | project    | always        | yes      | `spec-roadmap`       |
| POSITION    | executor  | mutable      | project    | always        | no       | `spec-state-update`  |
| DECISIONS   | interview | mutable→frozen | per-phase | phase-entry | yes      | `spec-discuss`       |
| PLAN        | agent     | frozen       | per-phase  | phase-entry   | no       | `spec-plan`          |
| MAP         | agent     | regenerable  | project    | on-demand     | no       | `spec-map`           |
| PATTERNS    | agent     | regenerable  | project    | on-demand     | no       | `spec-patterns`      |
| HISTORY     | system    | append-only  | project    | never         | no       | `spec-seal`          |
| VERIFY      | agent     | frozen       | per-phase  | on-demand     | no       | `spec-verify`        |

## Column definitions

**Author** — who is *primary* author of changes.
- `human`: a person writes; agents may assist but final wording is human-controlled.
- `agent`: a specialist agent generates; humans review.
- `interview`: co-authored via a structured Q&A skill (e.g. `$spec-discuss`).
- `executor`: agents updating state as work progresses (e.g. `$ralph` appending to STATE.md).
- `system`: produced by codexian CLI itself (e.g. seal records).

**Mutability** — allowed edit pattern.
- `mutable`: normal overwrite/edit OK.
- `frozen`: created once, not edited after creation event (PLAN is frozen on
  approval; VERIFY is frozen on production).
- `append-only`: lines may be added at the end; nothing is rewritten or
  removed (LEDGER.md, recent-decisions sections).
- `regenerable`: full file may be rebuilt from source by its owner agent; do not hand-edit.

**Lifecycle** — scope of the doc.
- `project`: one per project, lives the whole life of the repo.
- `per-phase`: one per ROADMAP phase; sealed when the phase completes.

**Load policy** — when the session-start hook (or other runtime
mechanisms) inject this doc into agent context.
- `always`: loaded at every session start. Keep these small (size budget!).
- `phase-entry`: loaded when the current phase matches.
- `on-demand`: loaded when a specific skill or query requests it.
- `never`: not auto-injected. Read only by tools or via deliberate user action.

**Forcing function** — when true, the act of completing the doc forces a
real decision. Empty required sections fail validation. INTENT, SCOPE,
ROADMAP, and DECISIONS are forcing functions; POSITION/PLAN/MAP/PATTERNS
are reference docs.

**Owner skill** — the codexian `$skill-name` that owns updates of this
kind. If an agent needs to write a doc of this kind, it should invoke
the owner skill rather than editing directly. Empty entries mean "no
owner skill yet" — currently INTENT and SCOPE are human-authored with
no orchestration skill.

## Rules that apply to *all* docs

1. **Kind marker is mandatory.** Every codexian doc carries
   `<!-- spec:kind: X -->` near the top. Files without a kind marker are
   not codexian docs and the validator/loader will ignore them.

2. **Mutability is enforced by skill, not by filesystem.** A `frozen`
   doc can technically be edited; the discipline lives in the agent
   prompts and the validator. Skills refuse to operate on frozen kinds.

3. **Size budgets matter for `always` docs.** The session-start context
   injection competes with the working context window. The combined
   size of all `always`-policy docs should stay under ~10% of the
   model's context window (roughly 2,000 lines at default settings).
   `codexian spec validate` warns when an `always` doc exceeds its
   per-kind budget.

4. **Forcing-function docs may not pass validation with template
   placeholders intact.** If `PROJECT.md` still contains
   `_TODO: Replace with your one-paragraph vision._`, the validator
   flags it. Until the template state is replaced, the project is
   not "spec-complete."

5. **New kinds require updating this file and `contract.ts` together.**
   Adding a new doc kind ad-hoc is forbidden. Update both the taxonomy
   matrix here and `DOC_KIND_SPECS` in `src/spec/contract.ts` in the
   same PR.

## How agents are taught the rules — the four channels

This taxonomy is not magic. Agents only follow it because the rules
are surfaced into their context through four channels:

1. **AGENTS.md insert** (`<!-- SPEC:CONTRACT:START -->` block) —
   every session, every agent sees the rule summary.
2. **In-doc preamble** — each template carries a "For agents reading
   this file" block that restates the kind-specific rules so an agent
   reading the doc sees its rules in the same context.
3. **Owner skills** — when an agent invokes `$spec-discuss`, the
   skill prompt contains the detailed rules for the DECISIONS kind.
   Same for `$spec-plan`, `$spec-seal`, etc.
4. **Validator** — `codexian spec validate` is a post-hoc check that
   surfaces violations into the next session's context.

Layers 1–3 are proactive (agent knows the rule before acting). Layer 4
is reactive (agent learns about violations from earlier work). A
planned fifth layer — pre/post tool-use hooks that inject kind rules
at file-write time — is intentionally deferred until real-world
violation patterns are observed.

## When to add a new kind

Add a new kind when a documentation need clearly does not fit any of
the ten existing kinds. Bad reasons: "I want a separate file for X."
Good reasons:
- It has a distinct author class (e.g. external compliance reviewer).
- It has a distinct mutability pattern not covered above.
- It needs its own load policy (e.g. loaded for one specific subteam).

When in doubt, prefer adding sections to existing docs over inventing
new kinds. The taxonomy is a discipline; kind sprawl is anti-discipline.
