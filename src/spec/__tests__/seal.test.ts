import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
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
