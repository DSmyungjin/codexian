import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { init } from '../init.js';
import {
  extractTeamTasks,
  formatTeamTasks,
  TeamTasksError,
} from '../team-tasks.js';

function makeTmpProject(): string {
  const cwd = mkdtempSync(join(tmpdir(), 'codexian-team-tasks-'));
  init({ cwd, noAgents: true });
  return cwd;
}

function seedContext(cwd: string, phase: number, body: string): void {
  writeFileSync(
    join(cwd, '.codexian', 'spec', `CONTEXT.phase-${phase}.md`),
    `<!-- SPEC:DOC:CONTEXT -->\n<!-- spec:kind: DECISIONS -->\n<!-- schema_version: 1 -->\n\n# CONTEXT — Phase ${phase}\n${body}\n`,
    'utf8',
  );
}

test('extractTeamTasks pulls AC-N bullets from the Acceptance criteria section', () => {
  const cwd = makeTmpProject();
  seedContext(
    cwd,
    1,
    `
## Acceptance criteria

- AC-1: ship the foo module with two public functions.
- AC-2: integration test covers the happy path.
- AC-3: doctor reports the new module under installed modules.
`.trim(),
  );

  const tasks = extractTeamTasks({ cwd, phase: 1 });
  assert.equal(tasks.length, 3);
  assert.equal(tasks[0].id, 'AC-1');
  assert.equal(tasks[1].id, 'AC-2');
  assert.equal(tasks[2].id, 'AC-3');
  assert.equal(tasks[0].phase, 1);
  assert.match(tasks[0].body, /two public functions/);
});

test('extractTeamTasks throws when no spec dir', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'codexian-no-spec-'));
  assert.throws(
    () => extractTeamTasks({ cwd, phase: 1 }),
    (err: unknown) =>
      err instanceof TeamTasksError && /no spec directory/i.test((err as Error).message),
  );
});

test('extractTeamTasks throws when CONTEXT for the phase is missing', () => {
  const cwd = makeTmpProject();
  assert.throws(
    () => extractTeamTasks({ cwd, phase: 99 }),
    (err: unknown) =>
      err instanceof TeamTasksError &&
      /CONTEXT\.phase-99\.md not found/i.test((err as Error).message),
  );
});

test('extractTeamTasks throws when Acceptance criteria section is absent', () => {
  const cwd = makeTmpProject();
  seedContext(cwd, 2, '## Some other section\n\n- not an AC bullet\n');
  assert.throws(
    () => extractTeamTasks({ cwd, phase: 2 }),
    (err: unknown) =>
      err instanceof TeamTasksError &&
      /no "## Acceptance criteria" section/i.test((err as Error).message),
  );
});

test('extractTeamTasks returns empty array when AC section exists but has no AC-N bullets', () => {
  const cwd = makeTmpProject();
  seedContext(
    cwd,
    3,
    '## Acceptance criteria\n\n- some free-form bullet without AC-N prefix\n',
  );
  assert.deepEqual(extractTeamTasks({ cwd, phase: 3 }), []);
});

test('formatTeamTasks supports human / json / ndjson / team-create', () => {
  const tasks = [
    { id: 'AC-1', title: 'do thing', body: 'do thing properly.', phase: 5 },
    { id: 'AC-2', title: 'do other', body: 'do other thing too.', phase: 5 },
  ];

  const human = formatTeamTasks(tasks, { format: 'human' });
  assert.match(human, /AC-1 \(phase 5\): do thing/);

  const json = JSON.parse(formatTeamTasks(tasks, { format: 'json' }));
  assert.equal(json.length, 2);
  assert.equal(json[0].id, 'AC-1');

  const ndjson = formatTeamTasks(tasks, { format: 'ndjson' });
  const lines = ndjson.split('\n').filter(Boolean);
  assert.equal(lines.length, 2);
  for (const line of lines) JSON.parse(line); // each line parseable

  const tc = formatTeamTasks(tasks, { format: 'team-create' });
  assert.match(tc, /omx team api create-task --input/);
  assert.match(tc, /AC-1: do thing/);
});

test('extractTeamTasks truncates long titles for readability', () => {
  const cwd = makeTmpProject();
  const long =
    'AC-1: ' + 'word '.repeat(50) + 'end-of-sentence text continues even longer';
  seedContext(cwd, 6, `## Acceptance criteria\n\n- ${long}\n`);
  const tasks = extractTeamTasks({ cwd, phase: 6 });
  assert.equal(tasks.length, 1);
  assert.ok(tasks[0].title.length <= 120, `title too long: ${tasks[0].title.length}`);
  // body preserves the full bullet, regardless
  assert.ok(tasks[0].body.length > 120);
});
