import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  findActiveWorkflows,
  hasAnyActive,
} from '../active-workflows.js';

function makeTmpProject(): string {
  return mkdtempSync(join(tmpdir(), 'codexian-active-'));
}

function writeRalphState(
  cwd: string,
  sessionId: string,
  state: Record<string, unknown>,
): void {
  const dir = join(cwd, '.omx', 'state', 'sessions', sessionId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'ralph-state.json'), JSON.stringify(state), 'utf8');
}

test('findActiveWorkflows returns empty when .omx/state/ is absent', () => {
  const cwd = makeTmpProject();
  const result = findActiveWorkflows(cwd);
  assert.deepEqual(result.ralph, []);
  assert.deepEqual(result.team, []);
  assert.equal(hasAnyActive(result), false);
});

test('findActiveWorkflows reports ralph sessions in non-terminal phases only', () => {
  const cwd = makeTmpProject();
  writeRalphState(cwd, 'sid-executing', { current_phase: 'executing', session_id: 'sid-executing' });
  writeRalphState(cwd, 'sid-fixing',    { current_phase: 'fixing',    session_id: 'sid-fixing' });
  writeRalphState(cwd, 'sid-complete',  { current_phase: 'complete',  session_id: 'sid-complete' });
  writeRalphState(cwd, 'sid-failed',    { current_phase: 'failed',    session_id: 'sid-failed' });
  writeRalphState(cwd, 'sid-blocked',   { current_phase: 'blocked_on_user', session_id: 'sid-blocked' });

  const result = findActiveWorkflows(cwd);
  const sessions = result.ralph.map((r) => r.sessionId).sort();
  assert.deepEqual(sessions, ['sid-executing', 'sid-fixing']);
  assert.equal(hasAnyActive(result), true);
});

test('findActiveWorkflows lists team directories', () => {
  const cwd = makeTmpProject();
  mkdirSync(join(cwd, '.omx', 'state', 'team', 'demo-team'), { recursive: true });
  mkdirSync(join(cwd, '.omx', 'state', 'team', 'another'), { recursive: true });
  writeFileSync(
    join(cwd, '.omx', 'state', 'team', 'demo-team', 'manifest.json'),
    '{}',
    'utf8',
  );

  const result = findActiveWorkflows(cwd);
  const names = result.team.map((t) => t.teamName).sort();
  assert.deepEqual(names, ['another', 'demo-team']);
  const demo = result.team.find((t) => t.teamName === 'demo-team');
  assert.ok(demo?.manifestPath, 'demo-team should report its manifest path');
  const another = result.team.find((t) => t.teamName === 'another');
  assert.equal(another?.manifestPath, null, 'team with no manifest should report null');
});

test('findActiveWorkflows tolerates malformed ralph-state.json without crashing', () => {
  const cwd = makeTmpProject();
  const dir = join(cwd, '.omx', 'state', 'sessions', 'broken-sid');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'ralph-state.json'), '{ not json', 'utf8');
  // Should not throw and should simply skip the malformed entry.
  const result = findActiveWorkflows(cwd);
  assert.deepEqual(result.ralph, []);
});
