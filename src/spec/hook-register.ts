/**
 * Phase 3 — Codex SessionStart hook auto-registration with auto-trust.
 *
 * What we discovered (correcting earlier framing): the Codex 0.129+
 * "hooks no longer fire" behaviour is NOT a bug. It is a deliberate
 * security trust gate. The hook system is operational; the dispatcher
 * just refuses to invoke a hook whose entry hasn't been trusted yet.
 * Trust state lives in `$CODEX_HOME/config.toml` under
 *   [hooks.state."<canonical-hooks-json-path>:<event_label>:<group_idx>:<handler_idx>"]
 *     trusted_hash = "sha256:<hex>"
 * The hash is sha256(canonicalJson(<normalised hook identity>)).
 *
 * Interactive TUI users trust via `/hooks`. Non-interactive `codex exec`
 * users have no UI surface — but the trust state is a plain file write,
 * which means codexian can flip the gate programmatically during
 * `spec init`.
 *
 * Verified empirically on Codex 0.130.0: with the correct canonical
 * path (`/private/tmp/...` rather than the `/tmp/...` symlink) and
 * matching hash, the project SessionStart hook fires, the side-effect
 * file is created, and additionalContext reaches the model.
 *
 * Caveats:
 *   - The trust hash is the same on every machine for a given
 *     normalised entry — but the entry includes the absolute command
 *     path, which is machine-specific. So the hash effectively keys on
 *     the machine + the install layout.
 *   - The hash key includes the canonical absolute path of the
 *     hooks.json file. macOS `/tmp` resolves to `/private/tmp`, so we
 *     always pass paths through `fs.realpathSync` before constructing
 *     the key.
 *   - This module never edits an existing trust hash for a foreign
 *     (non-codexian) entry. It only adds or refreshes the codexian
 *     entry.
 */

import { createHash } from 'crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'fs';
import { homedir } from 'os';
import { dirname, join } from 'path';

import { HOOK_FILENAME, SPEC_DIR } from './contract.js';

const SESSION_START_EVENT_LABEL = 'session_start';
const SESSION_START_MATCHER = 'startup|resume|clear';
const CODEXIAN_STATUS_MESSAGE = 'codexian spec session-start';

export interface HookRegisterOptions {
  /** Project root. Defaults to process.cwd(). */
  cwd?: string;
  /**
   * Skip writing the trust hash. Useful for dry-run or for users who
   * prefer to trust via the Codex TUI / Codex App themselves.
   */
  noTrust?: boolean;
  /**
   * Path to the user's Codex home. Defaults to $CODEX_HOME ||
   * ~/.codex.
   */
  codexHome?: string;
}

export type HookEntryAction = 'created' | 'appended' | 'unchanged' | 'refreshed';
export type TrustAction =
  | 'created'
  | 'updated'
  | 'unchanged'
  | 'skipped'
  | 'skipped-no-trust';

export interface HookRegisterResult {
  hooksJsonPath: string;
  hooksJsonAction: HookEntryAction;
  trustConfigPath: string | null;
  trustAction: TrustAction;
  trustKey: string;
  trustHash: string;
  command: string;
}

export class HookRegisterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HookRegisterError';
  }
}

function resolveCodexHome(opts: HookRegisterOptions): string {
  if (opts.codexHome) return opts.codexHome;
  return process.env.CODEX_HOME ?? join(homedir(), '.codex');
}

function canonicalJson<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => canonicalJson(v)) as T;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    out[key] = canonicalJson((value as Record<string, unknown>)[key]);
  }
  return out as T;
}

/**
 * Compute the SHA-256 trust hash for a normalised SessionStart hook
 * entry. Matches OMX's `versionForCodexTomlIdentity` exactly so the
 * Codex hook trust gate accepts it.
 */
export function computeTrustHash(input: {
  command: string;
  matcher?: string;
  statusMessage?: string;
  timeout?: number;
}): string {
  const identity = canonicalJson({
    event_name: SESSION_START_EVENT_LABEL,
    matcher: input.matcher ?? SESSION_START_MATCHER,
    hooks: [
      {
        type: 'command',
        command: input.command,
        timeout: Math.max(1, input.timeout ?? 600),
        async: false,
        ...(input.statusMessage ? { statusMessage: input.statusMessage } : {}),
      },
    ],
  });
  const ser = JSON.stringify(identity);
  return `sha256:${createHash('sha256').update(ser).digest('hex')}`;
}

function realPathOrSelf(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}

function buildHookCommand(projectRoot: string): string {
  const hookScript = realPathOrSelf(
    join(projectRoot, SPEC_DIR, 'hooks', HOOK_FILENAME),
  );
  // Quoted form matches the shape OMX writes to .codex/hooks.json so a
  // future hash collision detector / verifier can compare cleanly.
  return `"node" "${hookScript}"`;
}

interface HooksJsonShape {
  hooks?: {
    SessionStart?: Array<{
      matcher?: string;
      hooks?: Array<{
        type?: string;
        command?: string;
        statusMessage?: string;
        timeout?: number;
        async?: boolean;
      }>;
    }>;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

function loadHooksJson(path: string): HooksJsonShape {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as HooksJsonShape;
  } catch (err) {
    throw new HookRegisterError(
      `${path} is not valid JSON: ${(err as Error).message}. Refusing to overwrite — fix or remove the file and re-run.`,
    );
  }
}

function applyHookEntry(
  current: HooksJsonShape,
  command: string,
): { next: HooksJsonShape; action: HookEntryAction } {
  const next: HooksJsonShape = {
    ...current,
    hooks: { ...(current.hooks ?? {}) },
  };
  const sessionStart = [...(next.hooks!.SessionStart ?? [])];

  // Look for an existing codexian-managed entry — match by the
  // command string.
  let found = false;
  for (let groupIdx = 0; groupIdx < sessionStart.length; groupIdx++) {
    const group = sessionStart[groupIdx];
    const hookList = group.hooks ?? [];
    for (let handlerIdx = 0; handlerIdx < hookList.length; handlerIdx++) {
      const h = hookList[handlerIdx];
      if (h.command === command) {
        found = true;
        break;
      }
    }
    if (found) break;
  }

  if (found) {
    next.hooks!.SessionStart = sessionStart;
    return { next, action: 'unchanged' };
  }

  sessionStart.push({
    matcher: SESSION_START_MATCHER,
    hooks: [
      {
        type: 'command',
        command,
        statusMessage: CODEXIAN_STATUS_MESSAGE,
      },
    ],
  });
  next.hooks!.SessionStart = sessionStart;
  const action: HookEntryAction =
    !current.hooks?.SessionStart?.length ? 'created' : 'appended';
  return { next, action };
}

function trustStateKey(canonicalHooksJsonPath: string): string {
  return `${canonicalHooksJsonPath}:${SESSION_START_EVENT_LABEL}:0:0`;
}

/**
 * Minimal hand-written merge for the [hooks.state."<key>"] section
 * inside config.toml. We avoid pulling in a TOML library to keep the
 * spec module dependency-free; the section we touch is well-formed
 * and append-friendly, so a regex round-trip is enough.
 */
function applyTrustEntry(
  configText: string,
  key: string,
  hash: string,
): { next: string; action: TrustAction } {
  // Block shape we manage:
  //   [hooks.state."<key>"]
  //   trusted_hash = "sha256:<hex>"
  const escapedKey = key.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const sectionHeader = `[hooks.state."${escapedKey}"]`;
  const hashLine = `trusted_hash = "${hash}"`;

  const headerIdx = configText.indexOf(sectionHeader);
  if (headerIdx >= 0) {
    // Section exists. Find the trusted_hash line that follows it
    // (before the next [section] header).
    const afterHeader = configText.slice(headerIdx + sectionHeader.length);
    const nextHeaderRelIdx = afterHeader.search(/^\[/m);
    const sectionEnd =
      nextHeaderRelIdx >= 0
        ? headerIdx + sectionHeader.length + nextHeaderRelIdx
        : configText.length;
    const sectionBody = configText.slice(headerIdx + sectionHeader.length, sectionEnd);
    if (sectionBody.includes(hashLine)) {
      return { next: configText, action: 'unchanged' };
    }
    const newBody = sectionBody.replace(/trusted_hash\s*=\s*"[^"]*"/, hashLine);
    if (newBody === sectionBody) {
      // No existing trusted_hash line — append before section end.
      const insertion = sectionBody.endsWith('\n') ? `${hashLine}\n` : `\n${hashLine}\n`;
      return {
        next:
          configText.slice(0, headerIdx + sectionHeader.length) +
          sectionBody +
          insertion +
          configText.slice(sectionEnd),
        action: 'updated',
      };
    }
    return {
      next:
        configText.slice(0, headerIdx + sectionHeader.length) +
        newBody +
        configText.slice(sectionEnd),
      action: 'updated',
    };
  }

  // Section absent — append at end with a managed-by note.
  const sep = configText.endsWith('\n') ? '' : '\n';
  const block = `\n# codexian spec — Codex hook trust state (managed by \`codexian spec init\`)\n${sectionHeader}\n${hashLine}\n`;
  return { next: configText + sep + block, action: 'created' };
}

export function registerHook(opts: HookRegisterOptions = {}): HookRegisterResult {
  const cwd = realPathOrSelf(opts.cwd ?? process.cwd());

  // Ensure .codex/hooks.json target dir exists.
  const projectHooksDir = join(cwd, '.codex');
  const hooksJsonPath = join(projectHooksDir, 'hooks.json');
  mkdirSync(projectHooksDir, { recursive: true });

  const command = buildHookCommand(cwd);

  const current = loadHooksJson(hooksJsonPath);
  const { next, action: hooksJsonAction } = applyHookEntry(current, command);
  if (hooksJsonAction !== 'unchanged') {
    writeFileSync(hooksJsonPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  }

  const trustHash = computeTrustHash({
    command,
    matcher: SESSION_START_MATCHER,
    statusMessage: CODEXIAN_STATUS_MESSAGE,
  });
  const trustKey = trustStateKey(realPathOrSelf(hooksJsonPath));

  if (opts.noTrust) {
    return {
      hooksJsonPath,
      hooksJsonAction,
      trustConfigPath: null,
      trustAction: 'skipped-no-trust',
      trustKey,
      trustHash,
      command,
    };
  }

  const codexHome = resolveCodexHome(opts);
  const trustConfigPath = join(codexHome, 'config.toml');
  let trustAction: TrustAction;
  if (!existsSync(codexHome)) {
    // No Codex home → user probably hasn't installed Codex yet.
    // Skip with explicit marker rather than failing.
    return {
      hooksJsonPath,
      hooksJsonAction,
      trustConfigPath,
      trustAction: 'skipped',
      trustKey,
      trustHash,
      command,
    };
  }
  const currentToml = existsSync(trustConfigPath)
    ? readFileSync(trustConfigPath, 'utf8')
    : '';
  const { next: nextToml, action } = applyTrustEntry(currentToml, trustKey, trustHash);
  trustAction = action;
  if (action !== 'unchanged') {
    writeFileSync(trustConfigPath, nextToml, 'utf8');
  }

  return {
    hooksJsonPath,
    hooksJsonAction,
    trustConfigPath,
    trustAction,
    trustKey,
    trustHash,
    command,
  };
}
