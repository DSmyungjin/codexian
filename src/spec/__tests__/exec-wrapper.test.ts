import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { execWrapper } from '../exec-wrapper.js';
import { init } from '../init.js';

function makeTmpProject(): string {
  const cwd = mkdtempSync(join(tmpdir(), 'codexian-exec-wrapper-'));
  init({ cwd, noAgents: true });
  return cwd;
}

test('execWrapper refuses when --prompt is missing', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'codexian-exec-noprompt-'));
  const result = await execWrapper({ rawArgs: ['--skip-git-repo-check'], cwd, dryRun: true });
  assert.equal(result.code, 2);
  assert.equal(result.injectedContext, false);
});

test('execWrapper injects spec context when a spec dir exists (dry-run)', async () => {
  const cwd = makeTmpProject();
  const result = await execWrapper({
    rawArgs: ['--skip-git-repo-check', '--prompt', 'demo question'],
    cwd,
    dryRun: true,
  });
  assert.equal(result.code, 0);
  assert.equal(result.injectedContext, true, 'spec dir present → context should be injected');
  // session-start.mjs hook script should be present
  assert.ok(existsSync(join(cwd, '.codexian', 'spec', 'hooks', 'session-start.mjs')));
});

test('execWrapper passes through when no spec dir exists (dry-run)', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'codexian-exec-nospec-'));
  const result = await execWrapper({
    rawArgs: ['--prompt', 'plain question'],
    cwd,
    dryRun: true,
  });
  assert.equal(result.code, 0);
  assert.equal(result.injectedContext, false, 'no spec dir → no context to inject');
});

test('execWrapper supports --prompt= form and short -p alias', async () => {
  const cwd = makeTmpProject();
  // long form with =
  const r1 = await execWrapper({ rawArgs: ['--prompt=hello'], cwd, dryRun: true });
  assert.equal(r1.code, 0);
  // short form
  const r2 = await execWrapper({ rawArgs: ['-p', 'hello'], cwd, dryRun: true });
  assert.equal(r2.code, 0);
});
