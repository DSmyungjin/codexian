import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import { SEALED_DIR } from './contract.js';
import { locateSpecDir } from './locate.js';

export interface SealOptions {
  cwd?: string;
  phase: number;
  /** Free-text note appended to the seal record. */
  note?: string;
  /**
   * Allow overwriting an existing sealed snapshot. Off by default —
   * sealed files are immutable as a discipline; opt-in flag exists
   * for cases like correcting a botched seal during the same work
   * session before anyone else has seen it.
   */
  force?: boolean;
}

export class SealError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SealError';
  }
}

export interface SealResult {
  sealedDir: string;
  statePath: string;
  contextPath: string | null;
  ledgerPath: string;
}

export function seal(options: SealOptions): SealResult {
  const cwd = options.cwd ?? process.cwd();
  const located = locateSpecDir(cwd);
  if (!located) {
    throw new Error(
      `No spec directory found in ${cwd}. Run \`codexian spec init\` first.`,
    );
  }

  const sealedDir = join(located.dir, SEALED_DIR);
  mkdirSync(sealedDir, { recursive: true });

  const now = new Date().toISOString();
  const phase = options.phase;
  const force = options.force ?? false;

  const stateSrc = join(located.dir, 'STATE.md');
  const stateDest = join(sealedDir, `phase-${phase}.STATE.md`);
  if (!existsSync(stateSrc)) {
    throw new SealError('STATE.md not found; nothing to seal.');
  }
  if (existsSync(stateDest) && !force) {
    throw new SealError(
      `Phase ${phase} is already sealed: ${stateDest} exists. Sealed snapshots are immutable as a discipline. To correct a sealed phase, add a corrective phase to ROADMAP.md and seal that. Pass --force only if you are certain nothing else has consumed the existing seal yet.`,
    );
  }
  copyFileSync(stateSrc, stateDest);

  const ctxSrc = join(located.dir, `CONTEXT.phase-${phase}.md`);
  let ctxDest: string | null = null;
  if (existsSync(ctxSrc)) {
    ctxDest = join(sealedDir, `phase-${phase}.CONTEXT.md`);
    copyFileSync(ctxSrc, ctxDest);
  }

  // Update STATE.md last_sealed_phase / last_sealed_at if the lines exist.
  // Use [ \t]* (spaces/tabs only) rather than \s* so the trailing-whitespace
  // group never matches across newlines and eats subsequent headings.
  const stateText = readFileSync(stateSrc, 'utf8');
  const next = stateText
    .replace(/^([ \t]*last_sealed_phase:)[ \t]*[^\n]*$/m, `$1 ${phase}`)
    .replace(/^([ \t]*last_sealed_at:)[ \t]*[^\n]*$/m, `$1 ${now}`);
  if (next !== stateText) writeFileSync(stateSrc, next, 'utf8');

  // Append to a simple ledger for human + machine review.
  const ledgerPath = join(sealedDir, 'LEDGER.md');
  const line = `- ${now} — phase ${phase}${options.note ? ` — ${options.note.replace(/\n/g, ' ')}` : ''}\n`;
  if (existsSync(ledgerPath)) {
    const prev = readFileSync(ledgerPath, 'utf8');
    writeFileSync(ledgerPath, prev + line, 'utf8');
  } else {
    writeFileSync(
      ledgerPath,
      `# Seal ledger\n\nAppend-only record of sealed phases.\n\n${line}`,
      'utf8',
    );
  }

  return { sealedDir, statePath: stateDest, contextPath: ctxDest, ledgerPath };
}
