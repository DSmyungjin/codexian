import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { validate } from '../validate.js';

function makeTmpProject(): string {
  return mkdtempSync(join(tmpdir(), 'codexian-spec-validate-'));
}

function writeRequired(dir: string, files: Record<string, string>): void {
  const specDir = join(dir, '.codexian', 'spec');
  mkdirSync(specDir, { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(specDir, name), body, 'utf8');
  }
}

const MIN_PROJECT = `<!-- SPEC:DOC:PROJECT -->
<!-- spec:kind: INTENT -->
<!-- schema_version: 1 -->
# PROJECT
## Vision
codexian self-test fixture.
## Non-goals
none for fixture.
## Primary user
the test runner.
`;

const MIN_REQUIREMENTS = `<!-- SPEC:DOC:REQUIREMENTS -->
<!-- spec:kind: SCOPE -->
<!-- schema_version: 1 -->
# REQUIREMENTS
## Functional requirements
- fixture FR-1
## Out of scope
- nothing
`;

function roadmapWithPlan(planBody: string): string {
  return `<!-- SPEC:DOC:ROADMAP -->
<!-- spec:kind: ROADMAP -->
<!-- schema_version: 1 -->
# ROADMAP
## Phases
### Phase 1
- Goal: fixture
<!-- SPEC:PLAN:START phase-1 -->
${planBody}
<!-- SPEC:PLAN:END phase-1 -->
`;
}

const ROADMAP_NO_PLAN = `<!-- SPEC:DOC:ROADMAP -->
<!-- spec:kind: ROADMAP -->
<!-- schema_version: 1 -->
# ROADMAP
## Phases
### Phase 1
- Goal: fixture without plan markers.
`;

const STATE_PHASE_1 = `<!-- SPEC:DOC:STATE -->
<!-- spec:kind: POSITION -->
<!-- schema_version: 1 -->
# STATE
## Current phase
current_phase: 1
`;

function contextWithDecisions(decisions: string): string {
  return `<!-- SPEC:DOC:CONTEXT -->
<!-- spec:kind: DECISIONS -->
<!-- schema_version: 1 -->
# CONTEXT — Phase 1
## Acceptance criteria
- AC-1: fixture.

## Decisions
${decisions}
`;
}

test('validate flags D-IDs declared in CONTEXT but missing from PLAN', () => {
  const cwd = makeTmpProject();
  writeRequired(cwd, {
    'PROJECT.md': MIN_PROJECT,
    'REQUIREMENTS.md': MIN_REQUIREMENTS,
    'ROADMAP.md': roadmapWithPlan('plan cites D-01 only.'),
    'STATE.md': STATE_PHASE_1,
    'CONTEXT.phase-1.md': contextWithDecisions(
      '- **D-01** — covered.\n- **D-02** — not covered.\n',
    ),
  });

  const report = validate(cwd);
  const errors = report.issues.filter((i) => i.level === 'error');
  const missingCoverage = errors.find((i) =>
    i.message.includes('missing references to decisions: D-02'),
  );
  assert.ok(
    missingCoverage,
    `expected coverage error mentioning D-02, got: ${JSON.stringify(errors, null, 2)}`,
  );
  assert.equal(report.ok, false);
});

test('validate warns on D-IDs present in PLAN but absent from CONTEXT', () => {
  const cwd = makeTmpProject();
  writeRequired(cwd, {
    'PROJECT.md': MIN_PROJECT,
    'REQUIREMENTS.md': MIN_REQUIREMENTS,
    'ROADMAP.md': roadmapWithPlan('plan cites D-01 and D-99 (stale).'),
    'STATE.md': STATE_PHASE_1,
    'CONTEXT.phase-1.md': contextWithDecisions('- **D-01** — covered.\n'),
  });

  const report = validate(cwd);
  const warnings = report.issues.filter((i) => i.level === 'warning');
  const extraWarn = warnings.find((i) =>
    i.message.includes('not declared in CONTEXT.phase-1.md: D-99'),
  );
  assert.ok(
    extraWarn,
    `expected warning about D-99, got: ${JSON.stringify(warnings, null, 2)}`,
  );
});

test('validate is silent on coverage when ROADMAP has no plan section (D-04)', () => {
  const cwd = makeTmpProject();
  writeRequired(cwd, {
    'PROJECT.md': MIN_PROJECT,
    'REQUIREMENTS.md': MIN_REQUIREMENTS,
    'ROADMAP.md': ROADMAP_NO_PLAN,
    'STATE.md': STATE_PHASE_1,
    'CONTEXT.phase-1.md': contextWithDecisions(
      '- **D-01** — never planned.\n- **D-02** — never planned.\n',
    ),
  });

  const report = validate(cwd);
  const coverageIssues = report.issues.filter(
    (i) =>
      i.message.includes('missing references to decisions') ||
      i.message.includes('not declared in CONTEXT'),
  );
  assert.deepEqual(
    coverageIssues,
    [],
    `expected no coverage issues when plan is missing, got: ${JSON.stringify(coverageIssues, null, 2)}`,
  );
});

test('validate is silent on coverage when CONTEXT has no D-IDs', () => {
  const cwd = makeTmpProject();
  writeRequired(cwd, {
    'PROJECT.md': MIN_PROJECT,
    'REQUIREMENTS.md': MIN_REQUIREMENTS,
    'ROADMAP.md': roadmapWithPlan('plan cites D-99 (orphan, no CONTEXT IDs).'),
    'STATE.md': STATE_PHASE_1,
    'CONTEXT.phase-1.md': contextWithDecisions('- plain prose, no IDs.\n'),
  });

  const report = validate(cwd);
  const coverageIssues = report.issues.filter(
    (i) =>
      i.message.includes('missing references to decisions') ||
      i.message.includes('not declared in CONTEXT'),
  );
  assert.deepEqual(coverageIssues, []);
});

test('validate is silent on coverage when CONTEXT D-IDs are all referenced', () => {
  const cwd = makeTmpProject();
  writeRequired(cwd, {
    'PROJECT.md': MIN_PROJECT,
    'REQUIREMENTS.md': MIN_REQUIREMENTS,
    'ROADMAP.md': roadmapWithPlan(
      'plan references D-01 and later D-02 as well.',
    ),
    'STATE.md': STATE_PHASE_1,
    'CONTEXT.phase-1.md': contextWithDecisions(
      '- **D-01** — covered.\n- **D-02** — covered.\n',
    ),
  });

  const report = validate(cwd);
  const coverageIssues = report.issues.filter(
    (i) =>
      i.message.includes('missing references to decisions') ||
      i.message.includes('not declared in CONTEXT'),
  );
  assert.deepEqual(coverageIssues, []);
});

function writePlanFile(cwd: string, phase: number, body: string): void {
  const planDir = join(cwd, '.codexian', 'spec', 'plans');
  mkdirSync(planDir, { recursive: true });
  writeFileSync(
    join(planDir, `phase-${phase}.PLAN.md`),
    `<!-- SPEC:DOC:PLAN -->\n<!-- spec:kind: PLAN -->\n<!-- schema_version: 1 -->\n# PLAN — Phase ${phase}\n\n${body}`,
    'utf8',
  );
}

test('validate reads plan file when present, preferring it over ROADMAP markers', () => {
  const cwd = makeTmpProject();
  writeRequired(cwd, {
    'PROJECT.md': MIN_PROJECT,
    'REQUIREMENTS.md': MIN_REQUIREMENTS,
    // ROADMAP marker block is back-compat reference only (no D-IDs in body)
    'ROADMAP.md': roadmapWithPlan('See plans/phase-1.PLAN.md.'),
    'STATE.md': STATE_PHASE_1,
    'CONTEXT.phase-1.md': contextWithDecisions(
      '- **D-01** — must be in plan file.\n- **D-02** — must be in plan file.\n',
    ),
  });
  writePlanFile(cwd, 1, 'Plan body cites D-01 and D-02 inline.');

  const report = validate(cwd);
  const coverageIssues = report.issues.filter(
    (i) =>
      i.message.includes('missing references to decisions') ||
      i.message.includes('not declared in CONTEXT'),
  );
  assert.deepEqual(
    coverageIssues,
    [],
    `expected clean coverage from plan file, got: ${JSON.stringify(coverageIssues, null, 2)}`,
  );
});

test('validate errors on plan file with missing D-ID even when ROADMAP marker body cites it', () => {
  const cwd = makeTmpProject();
  writeRequired(cwd, {
    'PROJECT.md': MIN_PROJECT,
    'REQUIREMENTS.md': MIN_REQUIREMENTS,
    // ROADMAP "lies" about coverage — plan file is authoritative.
    'ROADMAP.md': roadmapWithPlan('legacy claim that D-01 and D-02 are covered'),
    'STATE.md': STATE_PHASE_1,
    'CONTEXT.phase-1.md': contextWithDecisions(
      '- **D-01** — covered in plan file.\n- **D-02** — missing from plan file.\n',
    ),
  });
  writePlanFile(cwd, 1, 'Plan body cites D-01 only.');

  const report = validate(cwd);
  const errors = report.issues.filter((i) => i.level === 'error');
  const missingErr = errors.find((i) =>
    i.message.includes('missing references to decisions: D-02'),
  );
  assert.ok(
    missingErr,
    `expected error mentioning D-02 missing from plan file, got: ${JSON.stringify(errors, null, 2)}`,
  );
  // Error message should mention plan file location, not ROADMAP.
  assert.ok(
    missingErr!.message.includes('plans/phase-1.PLAN.md'),
    'expected error to reference plans/phase-1.PLAN.md',
  );
});

function roadmapWithStatus(phase: number, status: string, planBody = ''): string {
  return `<!-- SPEC:DOC:ROADMAP -->
<!-- spec:kind: ROADMAP -->
<!-- schema_version: 1 -->
# ROADMAP
## Phases
### Phase ${phase}: fixture phase

- **Status:** \`${status}\`
- **Goal:** fixture

<!-- SPEC:PLAN:START phase-${phase} -->
${planBody}
<!-- SPEC:PLAN:END phase-${phase} -->
`;
}

function writePlanFileWithMarker(
  cwd: string,
  phase: number,
  body: string,
  approved: boolean,
): void {
  const planDir = join(cwd, '.codexian', 'spec', 'plans');
  mkdirSync(planDir, { recursive: true });
  const markerBlock = approved
    ? `<!-- spec:plan-check: approved -->\n<!-- spec:plan-check-reviewer: architect -->\n<!-- spec:plan-check-at: 2026-05-11T00:00:00Z -->\n\n`
    : '';
  writeFileSync(
    join(planDir, `phase-${phase}.PLAN.md`),
    `${markerBlock}<!-- SPEC:DOC:PLAN -->\n<!-- spec:kind: PLAN -->\n<!-- schema_version: 1 -->\n# PLAN — Phase ${phase}\n\n${body}`,
    'utf8',
  );
}

test('validate WARNs when current-phase plan file lacks plan-check marker', () => {
  const cwd = makeTmpProject();
  writeRequired(cwd, {
    'PROJECT.md': MIN_PROJECT,
    'REQUIREMENTS.md': MIN_REQUIREMENTS,
    'ROADMAP.md': roadmapWithStatus(1, '[~]', 'See plans/phase-1.PLAN.md.'),
    'STATE.md': STATE_PHASE_1,
    'CONTEXT.phase-1.md': contextWithDecisions('- **D-01** — covered.\n'),
  });
  writePlanFileWithMarker(cwd, 1, 'Plan body cites D-01.', false);

  const report = validate(cwd);
  const warnings = report.issues.filter((i) => i.level === 'warning');
  const planCheckWarn = warnings.find((i) =>
    i.message.includes('missing the architect approval marker'),
  );
  assert.ok(
    planCheckWarn,
    `expected plan-check warning, got: ${JSON.stringify(warnings, null, 2)}`,
  );
  assert.equal(planCheckWarn!.file, 'plans/phase-1.PLAN.md');
});

test('validate stays silent when plan file carries the approved marker', () => {
  const cwd = makeTmpProject();
  writeRequired(cwd, {
    'PROJECT.md': MIN_PROJECT,
    'REQUIREMENTS.md': MIN_REQUIREMENTS,
    'ROADMAP.md': roadmapWithStatus(1, '[~]', 'See plans/phase-1.PLAN.md.'),
    'STATE.md': STATE_PHASE_1,
    'CONTEXT.phase-1.md': contextWithDecisions('- **D-01** — covered.\n'),
  });
  writePlanFileWithMarker(cwd, 1, 'Plan body cites D-01.', true);

  const report = validate(cwd);
  const planCheckIssues = report.issues.filter((i) =>
    i.message.includes('missing the architect approval marker'),
  );
  assert.deepEqual(planCheckIssues, []);
});

test('validate exempts sealed-phase plan files from plan-check marker requirement', () => {
  const cwd = makeTmpProject();
  writeRequired(cwd, {
    'PROJECT.md': MIN_PROJECT,
    'REQUIREMENTS.md': MIN_REQUIREMENTS,
    'ROADMAP.md': roadmapWithStatus(1, '[x]', 'See plans/phase-1.PLAN.md.'),
    'STATE.md': STATE_PHASE_1,
    'CONTEXT.phase-1.md': contextWithDecisions('- **D-01** — covered.\n'),
  });
  // Sealed phase, plan file present, NO marker — should still pass.
  writePlanFileWithMarker(cwd, 1, 'Plan body cites D-01.', false);

  const report = validate(cwd);
  const planCheckIssues = report.issues.filter((i) =>
    i.message.includes('missing the architect approval marker'),
  );
  assert.deepEqual(
    planCheckIssues,
    [],
    `sealed phase should be exempt, got: ${JSON.stringify(planCheckIssues, null, 2)}`,
  );
});

test('validate falls back to ROADMAP markers when no plan file exists', () => {
  const cwd = makeTmpProject();
  writeRequired(cwd, {
    'PROJECT.md': MIN_PROJECT,
    'REQUIREMENTS.md': MIN_REQUIREMENTS,
    // No plan file, only legacy ROADMAP markers.
    'ROADMAP.md': roadmapWithPlan('plan body cites D-01 only here.'),
    'STATE.md': STATE_PHASE_1,
    'CONTEXT.phase-1.md': contextWithDecisions(
      '- **D-01** — covered.\n- **D-02** — missing.\n',
    ),
  });
  // No writePlanFile call.

  const report = validate(cwd);
  const errors = report.issues.filter((i) => i.level === 'error');
  const missingErr = errors.find((i) =>
    i.message.includes('missing references to decisions: D-02'),
  );
  assert.ok(missingErr, 'expected fallback gate to still fire');
  assert.ok(
    missingErr!.message.includes('ROADMAP.md'),
    'expected error to reference ROADMAP.md (legacy fallback location)',
  );
});
