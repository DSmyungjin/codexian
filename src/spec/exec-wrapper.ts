/**
 * codexian spec exec — Codex CLI wrapper that injects the spec
 * contract context via the user prompt, bypassing the SessionStart
 * hook regression on Codex 0.129+.
 *
 * Why: AGENTS.md mandatory directive works (verified), but only as a
 * model-discretion instruction. The hook channel would deliver the
 * same spec context as proper additionalContext system input — more
 * robust under long sessions and across model variants. Until Codex
 * upstream resolves the trust-gate issue (#21639), this wrapper
 * substitutes by running the session-start hook script ourselves and
 * prepending its output to the user prompt.
 *
 * Pattern:
 *   codexian spec exec [codex-exec-flags] --prompt "<text>"
 * is roughly equivalent to:
 *   codex exec [codex-exec-flags] "<spec-context>\n\n---\n\n<text>"
 *
 * The wrapper does NOT touch ~/.codex/config.toml trust state. It is
 * stateless and forwards all codex exec flags untouched.
 */

import { spawn, spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

import { HOOK_FILENAME } from './contract.js';
import { locateSpecDir } from './locate.js';

export interface ExecWrapperResult {
  /** Exit code returned by codex exec (or 127 on spawn failure). */
  code: number;
  /** Whether spec context was successfully prepended. */
  injectedContext: boolean;
}

export interface ExecWrapperArgs {
  /** All args after `codexian spec exec` (passthrough to codex exec). */
  rawArgs: readonly string[];
  /** Override cwd; defaults to process.cwd(). */
  cwd?: string;
  /** If true, only print the augmented invocation; do not spawn codex. */
  dryRun?: boolean;
}

const USAGE = `codexian spec exec — Codex CLI wrapper that injects the spec contract

Usage:
  codexian spec exec [codex-exec-flags] --prompt "<text>"

Required:
  --prompt, -p <text>   The user prompt for codex exec. Spec context is
                        prepended automatically when a spec dir is found.

Examples:
  codexian spec exec --prompt "What is the current phase?"
  codexian spec exec --skip-git-repo-check -C . -s read-only --prompt "..."
  codexian spec exec --dry-run --prompt "..."   # preview without spawning codex

Notes:
  - All flags except --prompt / --dry-run / --help are forwarded verbatim
    to \`codex exec\`. There is no parsing of codex-specific flags here;
    if codex rejects an argument the wrapper inherits the exit code.
  - When no spec dir is found in the cwd, the wrapper passes the prompt
    through unchanged.
  - The wrapper does not modify ~/.codex/config.toml — it never trusts
    or modifies hooks. It is a pure prompt-augmentation layer.
`;

function extractFlag(
  args: readonly string[],
  longName: string,
  shortName?: string,
): { value: string | null; remaining: string[] } {
  const remaining: string[] = [];
  let value: string | null = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === `--${longName}` || (shortName && a === `-${shortName}`)) {
      if (i + 1 < args.length) {
        value = args[i + 1];
        i++;
        continue;
      }
    }
    if (a.startsWith(`--${longName}=`)) {
      value = a.slice(longName.length + 3);
      continue;
    }
    remaining.push(a);
  }
  return { value, remaining };
}

function hasFlag(args: readonly string[], longName: string): boolean {
  return args.includes(`--${longName}`);
}

function readSpecContext(cwd: string): string | null {
  const located = locateSpecDir(cwd);
  if (!located) return null;
  const hookScript = join(located.dir, 'hooks', HOOK_FILENAME);
  if (!existsSync(hookScript)) return null;

  const result = spawnSync(process.execPath, [hookScript], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, CODEXIAN_PROJECT_ROOT: cwd },
    timeout: 10_000,
  });
  if (result.status !== 0 || !result.stdout) return null;

  try {
    const envelope = JSON.parse(result.stdout) as {
      hookSpecificOutput?: { additionalContext?: unknown };
    };
    const ctx = envelope?.hookSpecificOutput?.additionalContext;
    if (typeof ctx === 'string' && ctx.trim()) {
      return ctx.trim();
    }
  } catch {
    // Hook didn't emit valid JSON — fall through, return null
  }
  return null;
}

export async function execWrapper(opts: ExecWrapperArgs): Promise<ExecWrapperResult> {
  const cwd = opts.cwd ?? process.cwd();

  const helpRequested =
    opts.rawArgs.includes('--help') || opts.rawArgs.includes('-h');
  if (helpRequested && opts.rawArgs.length === 1) {
    console.log(USAGE);
    return { code: 0, injectedContext: false };
  }

  const dryRun = opts.dryRun ?? hasFlag(opts.rawArgs, 'dry-run');
  const args1 = opts.rawArgs.filter((a) => a !== '--dry-run');

  const { value: prompt, remaining } = extractFlag(args1, 'prompt', 'p');
  if (!prompt) {
    console.error(
      'error: codexian spec exec requires --prompt "<text>". Use `codex exec` directly for bare invocations.',
    );
    return { code: 2, injectedContext: false };
  }

  const specContext = readSpecContext(cwd);
  const augmentedPrompt = specContext
    ? `${specContext}\n\n---\n\n${prompt}`
    : prompt;
  const injectedContext = specContext != null;

  const codexArgs = ['exec', ...remaining, augmentedPrompt];

  if (dryRun) {
    console.log(`spec dir located: ${injectedContext ? 'yes' : 'no'}`);
    console.log(`context bytes prepended: ${specContext ? specContext.length : 0}`);
    console.log(`final argv: codex ${codexArgs.map((a) => JSON.stringify(a)).join(' ')}`);
    return { code: 0, injectedContext };
  }

  return new Promise<ExecWrapperResult>((resolve) => {
    const child = spawn('codex', codexArgs, {
      stdio: 'inherit',
      cwd,
    });
    child.on('exit', (code) => resolve({ code: code ?? 0, injectedContext }));
    child.on('error', (err) => {
      console.error(`failed to spawn codex: ${err.message}`);
      resolve({ code: 127, injectedContext });
    });
  });
}
