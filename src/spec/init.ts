import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import {
  HOOK_FILENAME,
  REQUIRED_DOCS,
  CONTEXT_TEMPLATE,
  SPEC_DIR,
} from './contract.js';

export interface InitOptions {
  /** Project root. Defaults to process.cwd(). */
  cwd?: string;
  /** Overwrite existing spec files. Default: false. */
  force?: boolean;
}

export interface InitResult {
  specDir: string;
  hookPath: string;
  created: string[];
  skipped: string[];
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

  const filesToCopy: [string, string][] = [
    ...REQUIRED_DOCS.map((name) => [name, name] as [string, string]),
    [CONTEXT_TEMPLATE, CONTEXT_TEMPLATE],
    [join('hooks', HOOK_FILENAME), join('hooks', HOOK_FILENAME)],
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

  return { specDir, hookPath, created, skipped };
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
