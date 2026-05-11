import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import { locateSpecDir } from './locate.js';

export interface RecordCompletionOptions {
  cwd?: string;
  /** Short slug naming the unit of work (e.g. ralph task slug). */
  slug: string;
  /** One-line summary appended to the Recent decisions entry. */
  summary?: string;
  /** Phase number this completion belongs to. Defaults to STATE.md's current_phase. */
  phase?: number;
  /** Paths to evidence artifacts (e.g. ralph-state.json) referenced in the log line. */
  evidence?: readonly string[];
}

export interface RecordCompletionResult {
  statePath: string;
  changedActiveWork: boolean;
  appendedRecentDecisions: boolean;
  ledgerLine: string;
}

export class RecordCompletionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecordCompletionError';
  }
}

/**
 * Record a Ralph (or other workflow) completion against STATE.md.
 *
 * The connection surface between OMX's ralph/team runtime state and
 * codexian's spec contract: when a long-running task finishes, expose
 * a primitive the workflow can call to materialise that fact in the
 * durable POSITION doc. This avoids hard-coupling ralph/completion-audit.ts
 * to the spec module — the LLM-driven ralph skill can `bash` this CLI
 * at completion, leaving ralph/* upstream-clean.
 *
 * Touches STATE.md only:
 *   - Appends one line under `## Recent decisions`.
 *   - If `## Active work` contains a bullet mentioning the slug, removes
 *     it (active work is now done).
 */
export function recordCompletion(
  options: RecordCompletionOptions,
): RecordCompletionResult {
  const cwd = options.cwd ?? process.cwd();
  const located = locateSpecDir(cwd);
  if (!located) {
    throw new RecordCompletionError(
      `No spec directory found in ${cwd}. Run \`codexian spec init\` first.`,
    );
  }
  const statePath = join(located.dir, 'STATE.md');
  if (!existsSync(statePath)) {
    throw new RecordCompletionError(
      `STATE.md not found at ${statePath}; spec dir is incomplete.`,
    );
  }
  const slug = options.slug.trim();
  if (!slug) {
    throw new RecordCompletionError(`slug must be a non-empty string`);
  }

  let stateText = readFileSync(statePath, 'utf8');

  // Resolve phase if caller didn't provide one.
  let phase = options.phase;
  if (phase == null) {
    const m = stateText.match(/^\s*current_phase:\s*(\d+)\s*$/m);
    if (m) phase = Number.parseInt(m[1], 10);
  }

  const now = new Date().toISOString();
  const summary = options.summary?.trim();
  const evidence = (options.evidence ?? [])
    .map((p) => p.trim())
    .filter(Boolean);

  const parts: string[] = [
    `- ${now} — Ralph completed: ${slug}`,
    phase != null ? `(phase ${phase})` : null,
    summary ? `— ${summary.replace(/\n/g, ' ')}` : null,
    evidence.length > 0 ? `Evidence: ${evidence.join(', ')}` : null,
  ].filter((s): s is string => Boolean(s));
  const ledgerLine = `${parts.join(' ')}.`;

  let changedActiveWork = false;
  let appendedRecentDecisions = false;

  // Remove Active work bullets mentioning the slug (case-insensitive).
  const activeHeadingRe = /^##\s+Active work[^\n]*$/m;
  const aw = stateText.match(activeHeadingRe);
  if (aw && aw.index != null) {
    const headingEndIdx = aw.index + aw[0].length;
    // Step past the trailing newline of the heading line, if any.
    const bodyStart =
      stateText[headingEndIdx] === '\n' ? headingEndIdx + 1 : headingEndIdx;
    const afterHeading = stateText.slice(bodyStart);
    const nextHeadingRelIdx = afterHeading.search(/^##\s+\S/m);
    const sectionEnd =
      nextHeadingRelIdx >= 0 ? bodyStart + nextHeadingRelIdx : stateText.length;
    const sectionBody = stateText.slice(bodyStart, sectionEnd);
    const slugLower = slug.toLowerCase();
    const filtered = sectionBody
      .split('\n')
      .filter((line) => {
        const trimmed = line.trim();
        if (!trimmed.startsWith('-')) return true;
        // Drop bullets that mention the slug.
        return !trimmed.toLowerCase().includes(slugLower);
      })
      .join('\n');
    if (filtered !== sectionBody) {
      stateText =
        stateText.slice(0, bodyStart) + filtered + stateText.slice(sectionEnd);
      changedActiveWork = true;
    }
  }

  // Insert ledger line at the top of ## Recent decisions (most recent at top
  // per template convention).
  const decisionsRe = /^(##\s+Recent decisions[^\n]*\n)/m;
  const dm = stateText.match(decisionsRe);
  if (dm && dm.index != null) {
    const insertAt = dm.index + dm[0].length;
    stateText =
      stateText.slice(0, insertAt) + `\n${ledgerLine}\n` + stateText.slice(insertAt);
    appendedRecentDecisions = true;
  }

  if (changedActiveWork || appendedRecentDecisions) {
    writeFileSync(statePath, stateText, 'utf8');
  }

  return {
    statePath,
    changedActiveWork,
    appendedRecentDecisions,
    ledgerLine,
  };
}
