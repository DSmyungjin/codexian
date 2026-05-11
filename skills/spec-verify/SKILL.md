---
name: spec-verify
description: Owner skill for the VERIFY kind — per-phase verification reports at .codexian/spec/verify/VERIFY.phase-N.md. Placeholder; today's verification is folded into $spec-seal.
---

# Spec Verify — Verification Report Owner (placeholder)

`$spec-verify` owns `.codexian/spec/verify/VERIFY.phase-N.md` (kind:
VERIFY). Intent: produce a durable, frozen report per phase that
records what was verified, how, and whether the phase passed
acceptance.

## Status

**Placeholder.** Today's verification flow is folded into
`$spec-seal`, which walks acceptance criteria interactively but
does not write a separate VERIFY artifact. This skill is the seam
for that artifact when (and if) the user wants stronger evidence.

## When implemented, this skill will

1. Read `CONTEXT.phase-N.md` to extract acceptance criteria.
2. For each criterion:
   - Ask the user (or a specialist agent) for evidence of pass/fail.
   - Capture the evidence link (command output, screenshot path,
     test name, etc.) into `VERIFY.phase-N.md`.
3. Produce a verdict: `pass` / `fail` / `partial`.
4. If `fail` or `partial`, diagnose root cause and queue a fix task
   into `STATE.md` `## Active work` so `$ralph` / `$team` can pick
   it up in the next session. Use the CLI primitive (see below) —
   do not edit STATE.md by hand from this skill.
5. Freeze the file. The seal step references this report; later
   sessions can audit phase verification without re-deriving it.

### Fix-task append (phase 4 surface)

When the verdict is `fail` or `partial`, shell out to the recorder
primitive instead of editing STATE.md inline:

```bash
codexian spec record-verify-failure <slug> \
  --fix-task "<actionable task title>" \
  --root-cause "<one-line diagnosis>" \
  --phase <N> \
  --evidence "<path/to/VERIFY.phase-N.md or transcript>"
```

Behavior contract (mirrors GSD `/gsd-verify-work` fix-plan append):

- Appends `- [fix] <fix-task> — root cause: ... Evidence: ... <!-- fix-slug: <slug> -->`
  under `## Active work`. Idempotent by slug — re-running the same
  slug does not duplicate the bullet.
- Always appends a fresh dated line under `## Recent decisions` so
  the failure history is chronological even when the slug re-fires.
- Creates the `## Active work` section if missing (defensive).

Pick a stable, hyphenated slug derived from the failing acceptance
criterion (e.g. `ac-6-coverage-regression`). The slug is the only
identifier the recorder uses for dedup, so make it specific.

## Strict rules (now and after implementation)

- **One report per phase.** Re-running this skill on a phase whose
  VERIFY file already exists refuses and tells the user to seal
  this phase before re-verifying it (or to add a corrective phase).
- **Frozen after production.** Once written, the file is not edited.
  To correct, create a new corrective phase.
- **Evidence-bound.** Do not record "verified" without an evidence
  pointer. Speculative or remembered verification does not count.

## Until then

`$spec-seal` walks acceptance criteria interactively. That is the
minimum bar. Use this skill's seam later if you find that you need
a durable record of *how* verification went, not just the fact that
the phase was sealed.
