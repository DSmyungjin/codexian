---
name: spec-seal
description: Verify a completed phase and snapshot STATE + CONTEXT into sealed/. The codexian equivalent of a ship gate.
---

# Spec Seal — Phase Completion Gate

`$spec-seal` is the codexian spec-contract entry into the ship step.
It is the *only* sanctioned way to mark a phase as done. Sealing
produces an append-only record under
`.codexian/spec/sealed/` and updates `STATE.md`'s `last_sealed_*`
fields so future sessions know the phase is closed.

## Usage

```
$spec-seal <phase-number> [--note "<short rationale>"]
```

## What this skill does

1. Locate the spec dir. Refuse if missing.
2. Read `ROADMAP.md` and confirm the phase exists and that its
   status marker is currently `[~]` (in progress) or `[ ]` (not
   started — unusual but allowed if the user genuinely jumped
   phases).
3. Read `STATE.md` and `CONTEXT.phase-N.md`. Walk the human through
   the phase acceptance criteria from `CONTEXT.phase-N.md`:
   - For each criterion, ask "verified?" and capture y/n + evidence.
   - If any criterion is not verified, stop. Do not seal a phase
     with unmet acceptance.
4. If all criteria pass, call the CLI:
   ```
   codexian spec seal <N> --note "<short rationale>"
   ```
   which:
   - Copies `STATE.md` to `sealed/phase-N.STATE.md`
   - Copies `CONTEXT.phase-N.md` to `sealed/phase-N.CONTEXT.md`
     (if present)
   - Updates `STATE.md` `last_sealed_phase` and `last_sealed_at`
   - Appends a line to `sealed/LEDGER.md`
5. Flip the `ROADMAP.md` status marker for phase N to `[x]`.
6. If phase N+1 exists, update `STATE.md` `current_phase: N+1`
   and append a recent-decisions line noting the transition.
7. Print the seal record path, the new current phase, and the
   recommended next command (typically `$spec-discuss <N+1>`).

## Strict rules

- **Acceptance criteria are the gate.** Do not seal a phase whose
  acceptance criteria are not all verifiable today. If the user
  insists, refuse and recommend amending `CONTEXT.phase-N.md` to
  document a known-broken criterion as a follow-up.
- **Sealed snapshots are immutable.** Once a phase is sealed, the
  files under `sealed/` are not rewritten. If you discover later
  that the seal was wrong, seal a new corrective phase rather than
  mutating the snapshot.
- **The ledger is append-only.** Never rewrite history in
  `sealed/LEDGER.md`.

## Failure modes

- Missing `STATE.md` → refuse and route to `codexian spec init`
- Phase already sealed (status `[x]`) → refuse and tell the user
  to inspect `sealed/LEDGER.md` if they think this is wrong
- Acceptance criteria empty in `CONTEXT.phase-N.md` → refuse and
  route to `$spec-discuss <N>` to add criteria before sealing
