import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  recordVerifyFailure,
  RecordVerifyFailureError,
} from '../record-verify-failure.js';

function makeTmpProject(stateBody: string): string {
  const cwd = mkdtempSync(join(tmpdir(), 'codexian-rvf-'));
  const specDir = join(cwd, '.codexian', 'spec');
  mkdirSync(specDir, { recursive: true });
  writeFileSync(join(specDir, 'STATE.md'), stateBody, 'utf8');
  return cwd;
}

const STATE_FULL = `# STATE

## Current phase

current_phase: 4

## Active work

<!-- What is being worked on right now. Updated by executors. -->

- Existing bullet should stay.

## Recent decisions

- 2026-05-11T00:00:00Z — Earlier decision.
`;

test('recordVerifyFailure appends a fix bullet under Active work', () => {
  const cwd = makeTmpProject(STATE_FULL);
  const result = recordVerifyFailure({
    cwd,
    slug: 'ac-6-coverage-regression',
    fixTask: 'Re-run plan coverage validator after fix',
    rootCause: 'Missing D-02 reference in plan body',
    evidence: ['.codexian/spec/verify/PHASE-4-RUN.md'],
  });

  assert.equal(result.appendedActiveWork, true);
  assert.equal(result.suppressedDuplicate, false);
  assert.equal(result.appendedRecentDecisions, true);

  const text = readFileSync(result.statePath, 'utf8');
  assert.match(
    text,
    /- \[fix\] Re-run plan coverage validator after fix — root cause: Missing D-02 reference in plan body — Evidence: \.codexian\/spec\/verify\/PHASE-4-RUN\.md\. <!-- fix-slug: ac-6-coverage-regression -->/,
  );
  // Existing bullet preserved.
  assert.match(text, /- Existing bullet should stay\./);
  // Ledger line at top of Recent decisions (ISO timestamp may include milliseconds).
  assert.match(
    text,
    /## Recent decisions\n\n- 20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z — Verify failure: ac-6-coverage-regression/,
  );
});

test('recordVerifyFailure is idempotent by slug on Active work', () => {
  const cwd = makeTmpProject(STATE_FULL);
  recordVerifyFailure({
    cwd,
    slug: 'dup-slug',
    fixTask: 'first call',
    rootCause: 'rc-1',
  });
  const second = recordVerifyFailure({
    cwd,
    slug: 'dup-slug',
    fixTask: 'second call should be suppressed',
    rootCause: 'rc-2',
  });

  assert.equal(second.appendedActiveWork, false);
  assert.equal(second.suppressedDuplicate, true);

  const text = readFileSync(second.statePath, 'utf8');
  const bullets = text.match(/<!-- fix-slug: dup-slug -->/g) ?? [];
  assert.equal(bullets.length, 1, 'expected exactly one fix-slug marker for dup-slug');
});

test('recordVerifyFailure always appends a fresh Recent decisions line, even on duplicate slug', () => {
  const cwd = makeTmpProject(STATE_FULL);
  recordVerifyFailure({
    cwd,
    slug: 'dup-history',
    fixTask: 'first',
  });
  recordVerifyFailure({
    cwd,
    slug: 'dup-history',
    fixTask: 'second',
  });

  const text = readFileSync(join(cwd, '.codexian/spec/STATE.md'), 'utf8');
  const lines = text.match(/Verify failure: dup-history/g) ?? [];
  assert.equal(
    lines.length,
    2,
    'expected two Recent decisions lines (history is append-only)',
  );
});

test('recordVerifyFailure creates Active work section when missing', () => {
  const STATE_NO_ACTIVE = `# STATE

## Current phase

current_phase: 4

## Recent decisions

- 2026-05-11T00:00:00Z — Earlier decision.
`;
  const cwd = makeTmpProject(STATE_NO_ACTIVE);
  const result = recordVerifyFailure({
    cwd,
    slug: 'no-active-section',
    fixTask: 'Patch the missing section',
  });

  assert.equal(result.createdActiveWorkSection, true);
  assert.equal(result.appendedActiveWork, true);

  const text = readFileSync(result.statePath, 'utf8');
  assert.match(text, /## Active work/);
  assert.match(text, /<!-- fix-slug: no-active-section -->/);
  // Inserted before Recent decisions, not after.
  assert.ok(
    text.indexOf('## Active work') < text.indexOf('## Recent decisions'),
    'Active work should precede Recent decisions',
  );
});

test('recordVerifyFailure throws RecordVerifyFailureError when STATE.md is missing', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'codexian-rvf-nostate-'));
  const specDir = join(cwd, '.codexian', 'spec');
  mkdirSync(specDir, { recursive: true });
  // No STATE.md written.
  assert.throws(
    () =>
      recordVerifyFailure({
        cwd,
        slug: 'x',
        fixTask: 'y',
      }),
    (err: unknown) =>
      err instanceof RecordVerifyFailureError &&
      /STATE\.md not found/.test((err as Error).message),
  );
});

test('recordVerifyFailure rejects empty slug and empty fixTask', () => {
  const cwd = makeTmpProject(STATE_FULL);
  assert.throws(
    () => recordVerifyFailure({ cwd, slug: '   ', fixTask: 'task' }),
    (err: unknown) =>
      err instanceof RecordVerifyFailureError &&
      /slug must be a non-empty/.test((err as Error).message),
  );
  assert.throws(
    () => recordVerifyFailure({ cwd, slug: 'ok', fixTask: '   ' }),
    (err: unknown) =>
      err instanceof RecordVerifyFailureError &&
      /fixTask must be a non-empty/.test((err as Error).message),
  );
});

test('recordVerifyFailure resolves phase from STATE.md current_phase when omitted', () => {
  const cwd = makeTmpProject(STATE_FULL);
  const result = recordVerifyFailure({
    cwd,
    slug: 'phase-inferred',
    fixTask: 'check phase resolution',
    rootCause: 'rc',
  });
  assert.match(result.ledgerLine, /\(phase 4\)/);
});
