import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { init } from '../init.js';
import { seal, SealError } from '../seal.js';

function makeTmpProject(): string {
  return mkdtempSync(join(tmpdir(), 'codexian-spec-seal-'));
}

function setupProject(): string {
  const cwd = makeTmpProject();
  init({ cwd, noAgents: true });
  // Replace the multi-phase placeholder roadmap with one that has
  // unambiguous `[~]` / `[ ]` statuses for the advance test.
  writeFileSync(
    join(cwd, '.codexian', 'spec', 'ROADMAP.md'),
    `<!-- SPEC:DOC:ROADMAP -->
<!-- spec:kind: ROADMAP -->
<!-- schema_version: 1 -->

# ROADMAP

## Phases

### Phase 1: Foundations

- **Status:** \`[~]\`
- **Goal:** Build the base.

### Phase 2: Core

- **Status:** \`[ ]\`
- **Goal:** Add the core.
`,
    'utf8',
  );
  return cwd;
}

test('seal creates STATE + CONTEXT snapshots and appends to LEDGER', () => {
  const cwd = setupProject();
  // Scaffold a CONTEXT for phase 1 so its snapshot is exercised too.
  writeFileSync(
    join(cwd, '.codexian', 'spec', 'CONTEXT.phase-1.md'),
    '# CONTEXT — Phase 1\n## Acceptance criteria\n- AC-1: real check.\n',
    'utf8',
  );

  const result = seal({ cwd, phase: 1, note: 'unit-test seal' });
  assert.ok(existsSync(result.statePath), 'sealed STATE snapshot should exist');
  assert.ok(result.contextPath && existsSync(result.contextPath), 'sealed CONTEXT snapshot should exist');
  assert.ok(existsSync(result.ledgerPath), 'LEDGER.md should exist');

  const ledger = readFileSync(result.ledgerPath, 'utf8');
  assert.match(ledger, /phase 1/, 'LEDGER should record phase 1');
  assert.match(ledger, /unit-test seal/, 'LEDGER should preserve the seal note');
});

test('seal refuses re-sealing an already-sealed phase without --force', () => {
  const cwd = setupProject();
  seal({ cwd, phase: 1 });
  assert.throws(
    () => seal({ cwd, phase: 1 }),
    (err: unknown) => err instanceof SealError && /already sealed/i.test((err as Error).message),
    'expected SealError citing immutability discipline on second seal',
  );
});

test('seal --advance flips ROADMAP statuses and bumps current_phase', () => {
  const cwd = setupProject();
  const result = seal({ cwd, phase: 1, advance: true });
  assert.ok(result.advanced, 'expected advanced field on --advance seal');
  assert.equal(result.advanced.roadmapFlipped, true, 'phase 1 status should flip [~]→[x]');
  assert.equal(result.advanced.nextRoadmapFlipped, true, 'phase 2 status should flip [ ]→[~]');
  assert.equal(result.advanced.statePhaseAdvanced, true, 'current_phase should be incremented');
  assert.equal(result.advanced.toPhase, 2);

  const roadmap = readFileSync(join(cwd, '.codexian', 'spec', 'ROADMAP.md'), 'utf8');
  assert.match(roadmap, /Phase 1[\s\S]*?\*\*Status:\*\*\s*`\[x\]`/, 'ROADMAP should show Phase 1 sealed [x]');
  assert.match(roadmap, /Phase 2[\s\S]*?\*\*Status:\*\*\s*`\[~\]`/, 'ROADMAP should show Phase 2 in progress [~]');

  const state = readFileSync(join(cwd, '.codexian', 'spec', 'STATE.md'), 'utf8');
  assert.match(state, /^current_phase:\s*2\s*$/m, 'STATE.md current_phase should be 2 after advance');
  assert.match(state, /^last_sealed_phase:\s*1\s*$/m, 'STATE.md last_sealed_phase should be 1');
});

test('seal --advance on the last phase flips status but leaves current_phase unchanged', () => {
  const cwd = makeTmpProject();
  init({ cwd, noAgents: true });
  // Single-phase roadmap.
  writeFileSync(
    join(cwd, '.codexian', 'spec', 'ROADMAP.md'),
    `<!-- SPEC:DOC:ROADMAP -->
<!-- spec:kind: ROADMAP -->
<!-- schema_version: 1 -->

# ROADMAP

## Phases

### Phase 1: Solo

- **Status:** \`[~]\`
- **Goal:** Only phase.
`,
    'utf8',
  );

  const result = seal({ cwd, phase: 1, advance: true });
  assert.ok(result.advanced);
  assert.equal(result.advanced.roadmapFlipped, true);
  assert.equal(result.advanced.nextRoadmapFlipped, false, 'no phase 2 to flip');
  assert.equal(result.advanced.statePhaseAdvanced, false, 'current_phase should not move past the last phase');
  assert.equal(result.advanced.toPhase, null);
});

test('seal returns activeAtSeal when ralph/team workflows are in flight (default mode)', () => {
  const cwd = setupProject();
  const sessionDir = join(cwd, '.omx', 'state', 'sessions', 'live-session');
  mkdirSync(sessionDir, { recursive: true });
  writeFileSync(
    join(sessionDir, 'ralph-state.json'),
    JSON.stringify({ current_phase: 'executing', session_id: 'live-session' }),
    'utf8',
  );
  const teamDir = join(cwd, '.omx', 'state', 'team', 'active-team');
  mkdirSync(teamDir, { recursive: true });

  const result = seal({ cwd, phase: 1, note: 'default-active' });
  // Default mode: surfaces active workflows but proceeds with the seal.
  assert.ok(result.activeAtSeal, 'expected activeAtSeal populated when not ignored');
  assert.equal(result.activeAtSeal.ralph.length, 1);
  assert.equal(result.activeAtSeal.ralph[0].sessionId, 'live-session');
  assert.equal(result.activeAtSeal.team.length, 1);
  assert.equal(result.activeAtSeal.team[0].teamName, 'active-team');
  assert.ok(existsSync(result.statePath), 'seal should still proceed in default mode');
});

test('seal --strict-active refuses when ralph or team workflows are in flight', () => {
  const cwd = setupProject();
  const sessionDir = join(cwd, '.omx', 'state', 'sessions', 'strict-block');
  mkdirSync(sessionDir, { recursive: true });
  writeFileSync(
    join(sessionDir, 'ralph-state.json'),
    JSON.stringify({ current_phase: 'verifying', session_id: 'strict-block' }),
    'utf8',
  );
  assert.throws(
    () => seal({ cwd, phase: 1, strictActive: true }),
    (err: unknown) =>
      err instanceof SealError &&
      /Refusing to seal/i.test((err as Error).message) &&
      /strict-block/.test((err as Error).message),
    'expected SealError citing the active session under strict mode',
  );
});

test('seal --ignore-active skips the workflow detector entirely', () => {
  const cwd = setupProject();
  const sessionDir = join(cwd, '.omx', 'state', 'sessions', 'ignored');
  mkdirSync(sessionDir, { recursive: true });
  writeFileSync(
    join(sessionDir, 'ralph-state.json'),
    JSON.stringify({ current_phase: 'executing', session_id: 'ignored' }),
    'utf8',
  );
  const result = seal({ cwd, phase: 1, ignoreActive: true });
  assert.equal(result.activeAtSeal, undefined, 'ignoreActive should suppress activeAtSeal entirely');
});
