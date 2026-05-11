import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  DECISION_ID_RE,
  computeCoverage,
  extractDecisionIds,
  extractPlanDecisionRefs,
  resolvePlanDecisionRefs,
} from '../decisions.js';

test('extractDecisionIds returns unique IDs in first-occurrence order', () => {
  const text = `
- **D-02** — body two
- **D-01** — body one
  - references D-02 again
- **D-11** — body eleven
`;
  assert.deepEqual(extractDecisionIds(text), ['D-02', 'D-01', 'D-11']);
});

test('extractDecisionIds accepts 3+ digit IDs and rejects single-digit', () => {
  const text = 'D-100 D-9 D-99 D-001 D-1';
  // D-9 / D-1 reject (min 2 digits); D-100 / D-99 / D-001 accept.
  assert.deepEqual(extractDecisionIds(text), ['D-100', 'D-99', 'D-001']);
});

test('extractDecisionIds returns [] when no IDs present', () => {
  assert.deepEqual(extractDecisionIds('no decisions here'), []);
});

test('DECISION_ID_RE is whitespace-bounded (word boundary)', () => {
  // Reset lastIndex since the regex is global.
  DECISION_ID_RE.lastIndex = 0;
  const matches = 'fooD-01 D-02bar D-03'.match(DECISION_ID_RE) ?? [];
  // D-01 follows "foo" — `\b` between "o" (word) and "D" (word) → no boundary, no match.
  // D-02 followed by "bar" — `\b` between "2" (word) and "b" (word) → no trailing boundary needed,
  // but regex matches if pattern itself sits at a boundary; D-02 is preceded by space (boundary) and
  // followed by "b" (no trailing boundary requirement in \b\d{2,}\b — \b only fires on transitions).
  // The regex `\bD-\d{2,}\b` requires a word boundary on both sides; "D-02bar" has digit→letter,
  // both word chars, so no trailing boundary → does not match.
  assert.deepEqual(matches, ['D-03']);
});

test('extractPlanDecisionRefs returns null when no plan markers for phase', () => {
  const roadmap = `# ROADMAP
### Phase 1
no plan here
`;
  assert.equal(extractPlanDecisionRefs(roadmap, 1), null);
});

test('extractPlanDecisionRefs returns [] when plan section is empty', () => {
  const roadmap = `
<!-- SPEC:PLAN:START phase-1 -->
<!-- SPEC:PLAN:END phase-1 -->
`;
  assert.deepEqual(extractPlanDecisionRefs(roadmap, 1), []);
});

test('extractPlanDecisionRefs picks up IDs only inside the matching phase markers', () => {
  const roadmap = `
<!-- SPEC:PLAN:START phase-1 -->
- step references D-01 and D-02
<!-- SPEC:PLAN:END phase-1 -->

<!-- SPEC:PLAN:START phase-2 -->
- step references D-03
<!-- SPEC:PLAN:END phase-2 -->
`;
  assert.deepEqual(extractPlanDecisionRefs(roadmap, 1), ['D-01', 'D-02']);
  assert.deepEqual(extractPlanDecisionRefs(roadmap, 2), ['D-03']);
});

test('extractPlanDecisionRefs tolerates missing END marker (reads to EOF)', () => {
  const roadmap = `
<!-- SPEC:PLAN:START phase-1 -->
plan body cites D-01
`;
  assert.deepEqual(extractPlanDecisionRefs(roadmap, 1), ['D-01']);
});

test('computeCoverage flags missing decisions and extra plan refs', () => {
  const cov = computeCoverage(
    ['D-01', 'D-02', 'D-03'],
    ['D-01', 'D-03', 'D-99'],
  );
  assert.deepEqual(cov.missing, ['D-02']);
  assert.deepEqual(cov.extra, ['D-99']);
});

test('computeCoverage returns empty arrays when plan covers decisions exactly', () => {
  const cov = computeCoverage(['D-01', 'D-02'], ['D-02', 'D-01']);
  assert.deepEqual(cov.missing, []);
  assert.deepEqual(cov.extra, []);
});

test('computeCoverage preserves declaration order in missing list', () => {
  const cov = computeCoverage(['D-05', 'D-01', 'D-03'], []);
  assert.deepEqual(cov.missing, ['D-05', 'D-01', 'D-03']);
});

// ─────────────────────────────────────────────────────────────────────
// resolvePlanDecisionRefs — file-backed resolver with fallback.
// ─────────────────────────────────────────────────────────────────────

function makeSpecDir(): string {
  const cwd = mkdtempSync(join(tmpdir(), 'codexian-resolve-'));
  const dir = join(cwd, 'spec');
  mkdirSync(dir, { recursive: true });
  return dir;
}

test('resolvePlanDecisionRefs returns plan-file IDs when file exists (preferred)', () => {
  const dir = makeSpecDir();
  mkdirSync(join(dir, 'plans'));
  writeFileSync(
    join(dir, 'plans', 'phase-1.PLAN.md'),
    '# PLAN\n\n- plan cites D-01 and D-02.',
  );
  // ROADMAP also has the marker block but with a different ID — must be ignored.
  writeFileSync(
    join(dir, 'ROADMAP.md'),
    '<!-- SPEC:PLAN:START phase-1 -->\n- legacy marker cites D-99.\n<!-- SPEC:PLAN:END phase-1 -->\n',
  );
  assert.deepEqual(resolvePlanDecisionRefs(dir, 1), ['D-01', 'D-02']);
});

test('resolvePlanDecisionRefs returns empty array when plan file exists but has no IDs', () => {
  const dir = makeSpecDir();
  mkdirSync(join(dir, 'plans'));
  writeFileSync(join(dir, 'plans', 'phase-2.PLAN.md'), '# PLAN\n\nNo IDs yet.');
  assert.deepEqual(resolvePlanDecisionRefs(dir, 2), []);
});

test('resolvePlanDecisionRefs falls back to ROADMAP markers when plan file is absent', () => {
  const dir = makeSpecDir();
  // No plans/ dir at all.
  writeFileSync(
    join(dir, 'ROADMAP.md'),
    '<!-- SPEC:PLAN:START phase-1 -->\n- legacy cites D-77.\n<!-- SPEC:PLAN:END phase-1 -->\n',
  );
  assert.deepEqual(resolvePlanDecisionRefs(dir, 1), ['D-77']);
});

test('resolvePlanDecisionRefs returns null when neither surface exists', () => {
  const dir = makeSpecDir();
  // No plans/ dir, no ROADMAP.md.
  assert.equal(resolvePlanDecisionRefs(dir, 1), null);
});

test('resolvePlanDecisionRefs returns null when ROADMAP has no markers for the requested phase', () => {
  const dir = makeSpecDir();
  writeFileSync(
    join(dir, 'ROADMAP.md'),
    '<!-- SPEC:PLAN:START phase-2 -->\nD-01\n<!-- SPEC:PLAN:END phase-2 -->\n',
  );
  // Querying phase 1 → no markers there, ROADMAP exists but null for this phase.
  assert.equal(resolvePlanDecisionRefs(dir, 1), null);
});
