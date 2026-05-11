import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import {
  CONTEXT_TEMPLATE,
  GENERATED_DIR,
  HOOK_FILENAME,
  REQUIRED_DOCS,
  SPEC_DIR,
} from './contract.js';
import { mergeAgentsHeritage, type AgentsMergeAction } from './agents-merge.js';
import {
  registerHook,
  type HookEntryAction,
  type TrustAction,
} from './hook-register.js';

export interface InitOptions {
  /** Project root. Defaults to process.cwd(). */
  cwd?: string;
  /** Overwrite existing spec files. Default: false. */
  force?: boolean;
  /** Skip merging the SPEC:CONTRACT block into project AGENTS.md. */
  noAgents?: boolean;
  /** Skip registering the SessionStart hook in .codex/hooks.json + ~/.codex/config.toml. */
  noHookRegister?: boolean;
  /** Register the hook entry but skip writing the trust hash. */
  noHookTrust?: boolean;
}

export interface InitResult {
  specDir: string;
  hookPath: string;
  created: string[];
  skipped: string[];
  agents?: { path: string; action: AgentsMergeAction };
  hookRegistration?: {
    hooksJsonPath: string;
    hooksJsonAction: HookEntryAction;
    trustConfigPath: string | null;
    trustAction: TrustAction;
  };
}

function templatesRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // dist/spec/init.js -> ../../templates/spec
  return join(here, '..', '..', 'templates', 'spec');
}

export function init(options: InitOptions = {}): InitResult {
  const cwd = options.cwd ?? process.cwd();
  const force = options.force ?? false;
  const specDir = join(cwd, SPEC_DIR);
  const hookDir = join(specDir, 'hooks');
  const hookPath = join(hookDir, HOOK_FILENAME);

  mkdirSync(specDir, { recursive: true });
  mkdirSync(hookDir, { recursive: true });

  const created: string[] = [];
  const skipped: string[] = [];
  const tplRoot = templatesRoot();

  mkdirSync(join(specDir, GENERATED_DIR), { recursive: true });

  const filesToCopy: [string, string][] = [
    ...REQUIRED_DOCS.map((name) => [name, name] as [string, string]),
    [CONTEXT_TEMPLATE, CONTEXT_TEMPLATE],
    [join('hooks', HOOK_FILENAME), join('hooks', HOOK_FILENAME)],
    [join(GENERATED_DIR, 'MAP.md'), join(GENERATED_DIR, 'MAP.md')],
    [join(GENERATED_DIR, 'PATTERNS.md'), join(GENERATED_DIR, 'PATTERNS.md')],
  ];

  for (const [src, dest] of filesToCopy) {
    const srcAbs = join(tplRoot, src);
    const destAbs = join(specDir, dest);
    if (existsSync(destAbs) && !force) {
      skipped.push(dest);
      continue;
    }
    if (!existsSync(srcAbs)) continue;
    cpSync(srcAbs, destAbs);
    created.push(dest);
  }

  ensureGitignoreEntry(cwd);

  let agents: { path: string; action: AgentsMergeAction } | undefined;
  if (!options.noAgents) {
    try {
      agents = mergeAgentsHeritage(cwd);
    } catch (err) {
      // If template is missing or unreadable, surface but do not fail init.
      const msg = err instanceof Error ? err.message : String(err);
      agents = { path: join(cwd, 'AGENTS.md'), action: 'unchanged' };
      console.warn(`warning: AGENTS.md heritage merge skipped — ${msg}`);
    }
  }

  let hookRegistration: InitResult['hookRegistration'];
  if (!options.noHookRegister) {
    try {
      const r = registerHook({ cwd, noTrust: options.noHookTrust });
      hookRegistration = {
        hooksJsonPath: r.hooksJsonPath,
        hooksJsonAction: r.hooksJsonAction,
        trustConfigPath: r.trustConfigPath,
        trustAction: r.trustAction,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`warning: hook registration skipped — ${msg}`);
    }
  }

  return { specDir, hookPath, created, skipped, agents, hookRegistration };
}

function ensureGitignoreEntry(cwd: string): void {
  const gi = join(cwd, '.gitignore');
  if (!existsSync(gi)) return;
  // Sealed snapshots and transient files inside spec dir stay tracked
  // by default. We do nothing here today; the seam exists so future
  // policies can opt-in.
}

export function writeContextDoc(
  cwd: string,
  phaseNumber: number,
  phaseName: string,
): string {
  const specDir = join(cwd, SPEC_DIR);
  const dest = join(specDir, `CONTEXT.phase-${phaseNumber}.md`);
  if (existsSync(dest)) return dest;
  const tplPath = join(templatesRoot(), CONTEXT_TEMPLATE);
  let body = '';
  if (existsSync(tplPath)) {
    body = readFileSync(tplPath, 'utf8');
  }
  body = body
    .replace(/\{\{N\}\}/g, String(phaseNumber))
    .replace(/\{\{phase_name\}\}/g, phaseName);
  writeFileSync(dest, body, 'utf8');
  return dest;
}
