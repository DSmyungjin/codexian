import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import { locateSpecDir } from './locate.js';

export interface RecordVerifyFailureOptions {
  cwd?: string;
  /** Short slug identifying the fix task (e.g. "ac-6-coverage-regression"). */
  slug: string;
  /** Human-readable fix task title — appended to ## Active work. */
  fixTask: string;
  /** One-line diagnosis. Recommended but not required. */
  rootCause?: string;
  /** Phase the failure belongs to. Defaults to STATE.md current_phase. */
  phase?: number;
  /** Paths to verify artifacts (e.g. .codexian/spec/verify/VERIFY.phase-N.md). */
  evidence?: readonly string[];
}

export interface RecordVerifyFailureResult {
  statePath: string;
  /** True when a new fix bullet was appended to ## Active work. */
  appendedActiveWork: boolean;
  /** True when the bullet was suppressed because the slug already exists. */
  suppressedDuplicate: boolean;
  /** Whether ## Active work was auto-created because it was missing. */
  createdActiveWorkSection: boolean;
  /** Always true on success — ledger line is always appended. */
  appendedRecentDecisions: boolean;
  /** The bullet body (without trailing fix-slug marker) that was or would be appended. */
  bulletBody: string;
  /** The Recent decisions ledger line that was appended. */
  ledgerLine: string;
}

export class RecordVerifyFailureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecordVerifyFailureError';
  }
}

/**
 * Record a verify-step failure against STATE.md.
 *
 * The opposite-direction sibling of `recordCompletion`: instead of clearing
 * an Active-work bullet on success, this primitive adds one on failure so
 * the next session sees a pending fix task.
 *
 * Mirrors GSD's `/gsd-verify-work` fix-plan append behavior: when
 * verification fails, the workflow diagnoses root cause and queues the
 * remediation as actionable Active work rather than ending in chat memory.
 *
 * Touches STATE.md only:
 *   - Adds `- [fix] <fixTask> — root cause: ... Evidence: ... <!-- fix-slug: <slug> -->`
 *     under `## Active work`. Idempotent by slug — re-running with the same
 *     slug does not duplicate the bullet.
 *   - Appends a fresh `- <ts> — Verify failure: <slug> ...` line under
 *     `## Recent decisions` on every call (failure history is chronological).
 */
export function recordVerifyFailure(
  options: RecordVerifyFailureOptions,
): RecordVerifyFailureResult {
  const cwd = options.cwd ?? process.cwd();
  const located = locateSpecDir(cwd);
  if (!located) {
    throw new RecordVerifyFailureError(
      `No spec directory found in ${cwd}. Run \`codexian spec init\` first.`,
    );
  }
  const statePath = join(located.dir, 'STATE.md');
  if (!existsSync(statePath)) {
    throw new RecordVerifyFailureError(
      `STATE.md not found at ${statePath}; spec dir is incomplete.`,
    );
  }

  const slug = options.slug.trim();
  if (!slug) {
    throw new RecordVerifyFailureError(`slug must be a non-empty string`);
  }
  const fixTask = options.fixTask.trim();
  if (!fixTask) {
    throw new RecordVerifyFailureError(
      `fixTask must be a non-empty string — recording a verify failure without an actionable task title is useless`,
    );
  }

  let stateText = readFileSync(statePath, 'utf8');

  // Resolve phase if caller didn't provide one.
  let phase = options.phase;
  if (phase == null) {
    const m = stateText.match(/^\s*current_phase:\s*(\d+)\s*$/m);
    if (m) phase = Number.parseInt(m[1], 10);
  }

  const rootCause = options.rootCause?.trim();
  const evidence = (options.evidence ?? [])
    .map((p) => p.trim())
    .filter(Boolean);

  const bulletParts: string[] = [`[fix] ${fixTask}`];
  if (rootCause) bulletParts.push(`root cause: ${rootCause}`);
  if (evidence.length > 0) bulletParts.push(`Evidence: ${evidence.join(', ')}`);
  const bulletBody = bulletParts.join(' — ');
  const slugMarker = `<!-- fix-slug: ${slug} -->`;
  const fullBullet = `- ${bulletBody}. ${slugMarker}`;

  const now = new Date().toISOString();
  const ledgerParts: string[] = [
    `- ${now} — Verify failure: ${slug}`,
    phase != null ? `(phase ${phase})` : null,
    rootCause ? `— ${rootCause.replace(/\n/g, ' ')}` : null,
    evidence.length > 0 ? `Evidence: ${evidence.join(', ')}` : null,
  ].filter((s): s is string => Boolean(s));
  const ledgerLine = `${ledgerParts.join(' ')}.`;

  let appendedActiveWork = false;
  let suppressedDuplicate = false;
  let createdActiveWorkSection = false;

  // ── Active work: append bullet idempotently by slug marker.
  const activeHeadingRe = /^##\s+Active work[^\n]*$/m;
  const aw = stateText.match(activeHeadingRe);
  if (aw && aw.index != null) {
    const headingEndIdx = aw.index + aw[0].length;
    const bodyStart =
      stateText[headingEndIdx] === '\n' ? headingEndIdx + 1 : headingEndIdx;
    const afterHeading = stateText.slice(bodyStart);
    const nextHeadingRelIdx = afterHeading.search(/^##\s+\S/m);
    const sectionEnd =
      nextHeadingRelIdx >= 0
        ? bodyStart + nextHeadingRelIdx
        : stateText.length;
    const sectionBody = stateText.slice(bodyStart, sectionEnd);

    if (sectionBody.includes(slugMarker)) {
      suppressedDuplicate = true;
    } else {
      // Append the new bullet at the end of the section body, before the next heading.
      // Trim trailing blank lines from the existing body, append bullet, then one blank line.
      const trimmedBody = sectionBody.replace(/\n+$/, '');
      const separator = trimmedBody.length > 0 ? '\n' : '';
      const newBody = `${trimmedBody}${separator}${fullBullet}\n\n`;
      stateText =
        stateText.slice(0, bodyStart) + newBody + stateText.slice(sectionEnd);
      appendedActiveWork = true;
    }
  } else {
    // No Active work section — create it. Insert before ## Recent decisions if present,
    // otherwise append at end of file.
    const decisionsRe = /^##\s+Recent decisions[^\n]*$/m;
    const dm = stateText.match(decisionsRe);
    const block = `## Active work\n\n<!-- What is being worked on right now. Updated by executors. -->\n\n${fullBullet}\n\n`;
    if (dm && dm.index != null) {
      stateText =
        stateText.slice(0, dm.index) + block + stateText.slice(dm.index);
    } else {
      const sep = stateText.endsWith('\n') ? '' : '\n';
      stateText = `${stateText}${sep}\n${block}`;
    }
    appendedActiveWork = true;
    createdActiveWorkSection = true;
  }

  // ── Recent decisions: always append a fresh ledger line at section top.
  let appendedRecentDecisions = false;
  const decisionsRe = /^(##\s+Recent decisions[^\n]*\n)/m;
  const dm = stateText.match(decisionsRe);
  if (dm && dm.index != null) {
    const insertAt = dm.index + dm[0].length;
    stateText =
      stateText.slice(0, insertAt) +
      `\n${ledgerLine}\n` +
      stateText.slice(insertAt);
    appendedRecentDecisions = true;
  }

  writeFileSync(statePath, stateText, 'utf8');

  return {
    statePath,
    appendedActiveWork,
    suppressedDuplicate,
    createdActiveWorkSection,
    appendedRecentDecisions,
    bulletBody,
    ledgerLine,
  };
}
