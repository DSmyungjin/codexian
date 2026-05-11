import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { init } from '../init.js';
import { recordCompletion, RecordCompletionError } from '../record-completion.js';

function makeTmpProject(): string {
  const cwd = mkdtempSync(join(tmpdir(), 'codexian-spec-recordcomp-'));
  init({ cwd, noAgents: true });
  return cwd;
}

test('recordCompletion appends a Recent decisions line and clears matching Active work', () => {
  const cwd = makeTmpProject();
  const statePath = join(cwd, '.codexian', 'spec', 'STATE.md');
  // Seed an Active work bullet that mentions the slug.
  const original = readFileSync(statePath, 'utf8');
  writeFileSync(
    statePath,
    original.replace(
      '- _TODO: nothing in flight_',
      '- Running ralph-unit-test task right now',
    ),
    'utf8',
  );

  const result = recordCompletion({
    cwd,
    slug: 'ralph-unit-test',
    summary: 'finished',
  });
  assert.equal(result.appendedRecentDecisions, true, 'should append to Recent decisions');
  assert.equal(result.changedActiveWork, true, 'should remove matching Active work bullet');

  const state = readFileSync(statePath, 'utf8');
  // Active work bullet removed.
  assert.doesNotMatch(state, /Running ralph-unit-test task/, 'matching bullet should be removed');
  // Recent decisions line added near top of section.
  assert.match(
    state,
    /## Recent decisions\n\n- \d{4}-\d{2}-\d{2}T[^\n]*Ralph completed: ralph-unit-test/,
    'should append ledger line at top of Recent decisions',
  );
});

test('recordCompletion is conservative when Active work has no matching bullet', () => {
  const cwd = makeTmpProject();
  const result = recordCompletion({ cwd, slug: 'no-match-slug' });
  // No bullet mentions the slug → cleanup did nothing, but ledger still appended.
  assert.equal(result.changedActiveWork, false);
  assert.equal(result.appendedRecentDecisions, true);
});

test('recordCompletion refuses on a project with no spec dir', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'codexian-no-spec-'));
  assert.throws(
    () => recordCompletion({ cwd, slug: 'whatever' }),
    (err: unknown) =>
      err instanceof RecordCompletionError && /no spec directory/i.test((err as Error).message),
    'expected RecordCompletionError when spec dir is absent',
  );
});

test('recordCompletion encodes evidence paths in the ledger line', () => {
  const cwd = makeTmpProject();
  const result = recordCompletion({
    cwd,
    slug: 'evidence-test',
    evidence: ['.omx/foo.json', '.omx/bar.json'],
  });
  assert.match(result.ledgerLine, /Evidence: \.omx\/foo\.json, \.omx\/bar\.json/);
});
