import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  DECISION_ID_RE,
  computeCoverage,
  extractDecisionIds,
  extractPlanDecisionRefs,
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
