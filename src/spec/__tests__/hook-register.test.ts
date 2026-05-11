import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { computeTrustHash, registerHook, HookRegisterError } from '../hook-register.js';
import { init } from '../init.js';

function makeSpecProject(): string {
  const cwd = mkdtempSync(join(tmpdir(), 'codexian-hook-reg-'));
  init({ cwd, noAgents: true, noHookRegister: true });
  return cwd;
}

function makeCodexHome(): string {
  return mkdtempSync(join(tmpdir(), 'codexian-codex-home-'));
}

test('computeTrustHash is deterministic and OMX-compatible', () => {
  const h1 = computeTrustHash({
    command: '"node" "/x.mjs"',
    matcher: 'startup|resume|clear',
    statusMessage: 'codexian spec session-start',
  });
  const h2 = computeTrustHash({
    command: '"node" "/x.mjs"',
    matcher: 'startup|resume|clear',
    statusMessage: 'codexian spec session-start',
  });
  assert.equal(h1, h2);
  assert.match(h1, /^sha256:[a-f0-9]{64}$/);
});

test('registerHook creates hooks.json + trust entry from a clean state', () => {
  const cwd = makeSpecProject();
  const codexHome = makeCodexHome();

  const r = registerHook({ cwd, codexHome });
  assert.equal(r.hooksJsonAction, 'created');
  assert.equal(r.trustAction, 'created');

  // hooks.json shape
  const hooks = JSON.parse(readFileSync(r.hooksJsonPath, 'utf8'));
  const ss = hooks.hooks.SessionStart;
  assert.equal(ss.length, 1);
  assert.equal(ss[0].matcher, 'startup|resume|clear');
  assert.match(ss[0].hooks[0].command, /\.codexian\/spec\/hooks\/session-start\.mjs/);

  // config.toml trust state shape
  const toml = readFileSync(r.trustConfigPath!, 'utf8');
  assert.match(toml, new RegExp(`\\[hooks\\.state\\."${realpathSync(r.hooksJsonPath).replace(/\\/g, '\\\\').replace(/[.*+?^${}()|[\]/]/g, '\\$&')}:session_start:0:0"\\]`));
  assert.match(toml, /trusted_hash\s*=\s*"sha256:[a-f0-9]{64}"/);
});

test('registerHook is idempotent — second call leaves things unchanged', () => {
  const cwd = makeSpecProject();
  const codexHome = makeCodexHome();

  const r1 = registerHook({ cwd, codexHome });
  const r2 = registerHook({ cwd, codexHome });
  assert.equal(r2.hooksJsonAction, 'unchanged');
  assert.equal(r2.trustAction, 'unchanged');
  // Hashes match
  assert.equal(r1.trustHash, r2.trustHash);
});

test('registerHook preserves a non-codexian SessionStart entry', () => {
  const cwd = makeSpecProject();
  const codexHome = makeCodexHome();
  const hooksJsonPath = join(cwd, '.codex', 'hooks.json');
  mkdirSync(join(cwd, '.codex'), { recursive: true });
  writeFileSync(
    hooksJsonPath,
    JSON.stringify(
      {
        hooks: {
          SessionStart: [
            {
              matcher: 'startup|resume',
              hooks: [
                {
                  type: 'command',
                  command: '/other-tool/hook.sh',
                  statusMessage: 'other tool',
                },
              ],
            },
          ],
        },
      },
      null,
      2,
    ),
    'utf8',
  );

  registerHook({ cwd, codexHome });
  const parsed = JSON.parse(readFileSync(hooksJsonPath, 'utf8'));
  const ss = parsed.hooks.SessionStart;
  assert.equal(ss.length, 2, 'should have both the foreign entry and the codexian entry');
  // First entry is the foreign one — preserved byte-for-byte at the command level
  assert.equal(ss[0].hooks[0].command, '/other-tool/hook.sh');
  assert.equal(ss[0].hooks[0].statusMessage, 'other tool');
});

test('registerHook with noTrust writes hooks.json only', () => {
  const cwd = makeSpecProject();
  const codexHome = makeCodexHome();
  const r = registerHook({ cwd, codexHome, noTrust: true });
  assert.equal(r.hooksJsonAction, 'created');
  assert.equal(r.trustAction, 'skipped-no-trust');
  // No trust entry written
  const configToml = join(codexHome, 'config.toml');
  if (existsSync(configToml)) {
    const toml = readFileSync(configToml, 'utf8');
    assert.doesNotMatch(toml, /trusted_hash/);
  }
});

test('registerHook skips trust write when codexHome does not exist', () => {
  const cwd = makeSpecProject();
  const codexHome = join(tmpdir(), `codexian-no-home-${Date.now()}`);
  const r = registerHook({ cwd, codexHome });
  assert.equal(r.trustAction, 'skipped');
});

test('registerHook refuses to overwrite malformed hooks.json', () => {
  const cwd = makeSpecProject();
  const codexHome = makeCodexHome();
  mkdirSync(join(cwd, '.codex'), { recursive: true });
  writeFileSync(join(cwd, '.codex', 'hooks.json'), '{ not json', 'utf8');
  assert.throws(
    () => registerHook({ cwd, codexHome }),
    (err: unknown) =>
      err instanceof HookRegisterError &&
      /not valid JSON/i.test((err as Error).message),
  );
});
