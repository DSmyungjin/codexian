import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { init } from '../init.js';

function makeTmpProject(): string {
  return mkdtempSync(join(tmpdir(), 'codexian-spec-init-'));
}

test('init scaffolds all canonical files on a fresh project', () => {
  const cwd = makeTmpProject();
  const result = init({ cwd, noAgents: true });

  // 5 canonical docs + CONTEXT template + hook script + 2 generated placeholders.
  const expected = [
    'PROJECT.md',
    'REQUIREMENTS.md',
    'ROADMAP.md',
    'STATE.md',
    'CONTEXT.template.md',
    'hooks/session-start.mjs',
    'generated/MAP.md',
    'generated/PATTERNS.md',
  ];
  for (const name of expected) {
    assert.ok(
      existsSync(join(result.specDir, name)),
      `expected ${name} to exist after init`,
    );
  }
  assert.deepEqual(result.created.sort(), expected.sort());
  assert.deepEqual(result.skipped, []);
  // noAgents path explicitly disables AGENTS.md merge.
  assert.equal(result.agents, undefined);
});

test('init is idempotent — second run skips existing files', () => {
  const cwd = makeTmpProject();
  init({ cwd, noAgents: true });
  const second = init({ cwd, noAgents: true });

  // All files already present → skipped, nothing newly created.
  assert.deepEqual(second.created, []);
  assert.ok(
    second.skipped.length >= 5,
    `expected at least the 5 canonical docs to be skipped on re-run, got ${second.skipped.length}`,
  );
  // The canonical 5 should be in the skipped list.
  for (const name of ['PROJECT.md', 'REQUIREMENTS.md', 'ROADMAP.md', 'STATE.md']) {
    assert.ok(
      second.skipped.includes(name),
      `expected ${name} to be skipped on second init`,
    );
  }
});

test('init --force overwrites user edits to canonical docs', () => {
  const cwd = makeTmpProject();
  init({ cwd, noAgents: true });
  const projectPath = join(cwd, '.codexian', 'spec', 'PROJECT.md');
  writeFileSync(projectPath, '# overwritten by user\n', 'utf8');
  assert.equal(readFileSync(projectPath, 'utf8'), '# overwritten by user\n');

  const forced = init({ cwd, noAgents: true, force: true });
  assert.ok(
    forced.created.includes('PROJECT.md'),
    `expected PROJECT.md to be recreated under --force, got created=${JSON.stringify(forced.created)}`,
  );
  const restored = readFileSync(projectPath, 'utf8');
  assert.ok(
    restored.includes('<!-- SPEC:DOC:PROJECT -->'),
    'expected restored PROJECT.md to carry the SPEC:DOC marker',
  );
});

test('init auto-merges AGENTS.md when noAgents is not set', () => {
  const cwd = makeTmpProject();
  const result = init({ cwd });
  assert.ok(result.agents, 'expected agents merge result when noAgents=false');
  assert.equal(result.agents.action, 'created');
  const agentsText = readFileSync(join(cwd, 'AGENTS.md'), 'utf8');
  assert.ok(
    agentsText.includes('<!-- SPEC:CONTRACT:START -->'),
    'expected AGENTS.md to contain SPEC:CONTRACT:START marker',
  );
  assert.ok(
    agentsText.includes('<!-- SPEC:CONTRACT:END -->'),
    'expected AGENTS.md to contain SPEC:CONTRACT:END marker',
  );
  assert.ok(
    agentsText.includes('Mandatory first action'),
    'expected AGENTS.md to contain the Mandatory first action directive',
  );
});
