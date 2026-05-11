import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import {
  findActiveWorkflows,
  hasAnyActive,
  summariseActiveWorkflows,
  type ActiveWorkflows,
} from './active-workflows.js';
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
  /**
   * After sealing, advance the workflow to the next phase:
   *   - Flip ROADMAP.md status for phase N from `[~]` or `[ ]` → `[x]`
   *   - Flip ROADMAP.md status for phase N+1 from `[ ]` → `[~]` (if it exists)
   *   - Set STATE.md current_phase to N+1 (only if phase N+1 exists in ROADMAP)
   *   - Append a transition line to STATE.md ## Recent decisions
   *
   * Off by default so the CLI primitive stays low-level; the
   * spec-seal skill is responsible for invoking the workflow advance
   * when run from inside Codex. Set --advance on the CLI for
   * scripted seals that want the transition in one call.
   */
  advance?: boolean;
  /**
   * Skip the ralph/team active-workflow check entirely. Use when the
   * caller has verified there is no active work or is intentionally
   * sealing during a long-lived ralph session.
   */
  ignoreActive?: boolean;
  /**
   * Treat any active ralph/team workflow as a hard error and refuse
   * the seal. Default behaviour collects active workflows in the
   * result so the caller can warn but does not block.
   */
  strictActive?: boolean;
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
  /** Set when --advance was used and the transition succeeded. */
  advanced?: {
    fromPhase: number;
    toPhase: number | null;
    roadmapFlipped: boolean;
    nextRoadmapFlipped: boolean;
    statePhaseAdvanced: boolean;
  };
  /**
   * Active ralph/team workflows detected at seal time. Populated
   * unless ignoreActive=true. Empty arrays when no active work was
   * found. Strict mode throws instead of returning these.
   */
  activeAtSeal?: ActiveWorkflows;
}

export function seal(options: SealOptions): SealResult {
  const cwd = options.cwd ?? process.cwd();
  const located = locateSpecDir(cwd);
  if (!located) {
    throw new Error(
      `No spec directory found in ${cwd}. Run \`codexian spec init\` first.`,
    );
  }

  // C4 interlock: detect active ralph/team workflows before snapshotting.
  let activeAtSeal: ActiveWorkflows | undefined;
  if (!options.ignoreActive) {
    activeAtSeal = findActiveWorkflows(cwd);
    if (options.strictActive && hasAnyActive(activeAtSeal)) {
      const summary = summariseActiveWorkflows(activeAtSeal).join('; ');
      throw new SealError(
        `Refusing to seal phase ${options.phase} while active workflows are in flight (strict mode): ${summary}. Pass --ignore-active to override, or shut down the workflow first.`,
      );
    }
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

  let advanced: SealResult['advanced'] | undefined;
  if (options.advance) {
    advanced = advanceWorkflow(located.dir, phase, now);
  }

  return {
    sealedDir,
    statePath: stateDest,
    contextPath: ctxDest,
    ledgerPath,
    advanced,
    activeAtSeal,
  };
}

/**
 * Flip the ROADMAP status marker on the entry whose heading is
 * `### Phase N: ...`. Returns true if the marker was actually
 * changed (which implies the phase exists in ROADMAP and its
 * status matched one of the allowed source markers).
 *
 * Implemented as a string scan to sidestep regex-escape pitfalls
 * with the backtick-bracket marker tokens.
 */
function flipRoadmapStatus(
  roadmapText: string,
  phase: number,
  fromMarkers: string[],
  toMarker: string,
): { text: string; flipped: boolean } {
  const heading = `### Phase ${phase}:`;
  const phaseIdx = roadmapText.indexOf(heading);
  if (phaseIdx < 0) return { text: roadmapText, flipped: false };

  // Only look inside this phase's entry (up to the next ### heading).
  const tail = roadmapText.slice(phaseIdx);
  const nextHeadingRelIdx = tail.indexOf('\n### ', heading.length);
  const scopeEnd =
    nextHeadingRelIdx >= 0 ? phaseIdx + nextHeadingRelIdx : roadmapText.length;
  const scope = roadmapText.slice(phaseIdx, scopeEnd);

  for (const from of fromMarkers) {
    const idx = scope.indexOf(from);
    if (idx < 0) continue;
    // Verify the marker sits on a Status line — guards against false
    // matches elsewhere in the phase body.
    const lineStart = scope.lastIndexOf('\n', idx) + 1;
    const line = scope.slice(lineStart, scope.indexOf('\n', idx));
    if (!/\*\*Status:\*\*/.test(line)) continue;

    const absIdx = phaseIdx + idx;
    return {
      text:
        roadmapText.slice(0, absIdx) +
        toMarker +
        roadmapText.slice(absIdx + from.length),
      flipped: true,
    };
  }
  return { text: roadmapText, flipped: false };
}

function advanceWorkflow(
  specDir: string,
  phase: number,
  now: string,
): NonNullable<SealResult['advanced']> {
  const result: NonNullable<SealResult['advanced']> = {
    fromPhase: phase,
    toPhase: null,
    roadmapFlipped: false,
    nextRoadmapFlipped: false,
    statePhaseAdvanced: false,
  };

  // 1. Flip ROADMAP statuses if the file exists.
  const roadmapPath = join(specDir, 'ROADMAP.md');
  let nextPhaseExists = false;
  if (existsSync(roadmapPath)) {
    let roadmap = readFileSync(roadmapPath, 'utf8');

    const step1 = flipRoadmapStatus(roadmap, phase, ['`[~]`', '`[ ]`'], '`[x]`');
    roadmap = step1.text;
    result.roadmapFlipped = step1.flipped;

    const step2 = flipRoadmapStatus(roadmap, phase + 1, ['`[ ]`'], '`[~]`');
    roadmap = step2.text;
    result.nextRoadmapFlipped = step2.flipped;

    // Detect whether phase N+1 exists at all (status flip not strictly required).
    const nextRe = new RegExp(`^### Phase ${phase + 1}:`, 'm');
    nextPhaseExists = nextRe.test(roadmap);

    if (step1.flipped || step2.flipped) {
      writeFileSync(roadmapPath, roadmap, 'utf8');
    }
  }

  // 2. Advance STATE.md current_phase + append a recent-decisions line.
  const statePath = join(specDir, 'STATE.md');
  if (!existsSync(statePath)) return result;
  let stateText = readFileSync(statePath, 'utf8');

  if (nextPhaseExists) {
    const before = stateText;
    stateText = stateText.replace(
      /^(\s*current_phase:)[ \t]*\d+[ \t]*$/m,
      `$1 ${phase + 1}`,
    );
    result.statePhaseAdvanced = before !== stateText;
    if (result.statePhaseAdvanced) result.toPhase = phase + 1;
  }

  // Append a transition entry to ## Recent decisions if that heading exists.
  const decisionsRe = /^(##\s+Recent decisions[^\n]*\n)/m;
  const decisionsMatch = stateText.match(decisionsRe);
  if (decisionsMatch && decisionsMatch.index !== undefined) {
    const insertAt = decisionsMatch.index + decisionsMatch[0].length;
    const line =
      `\n- ${now} — Sealed phase ${phase} and advanced to ` +
      (result.statePhaseAdvanced ? `phase ${phase + 1}` : `(no phase ${phase + 1} in roadmap)`) +
      '.\n';
    stateText = stateText.slice(0, insertAt) + line + stateText.slice(insertAt);
  }

  writeFileSync(statePath, stateText, 'utf8');
  return result;
}
