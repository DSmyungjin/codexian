/**
 * codexian spec team-tasks — extract candidate team tasks from a
 * phase's Acceptance criteria.
 *
 * The C3 connection surface from the Ralph/Team analysis: ROADMAP-
 * and CONTEXT-driven team task generation. Rather than modify
 * src/cli/team.ts (a 75 KB OMX hot file we want to leave alone for
 * upstream-cherry-pick discipline), this surfaces a thin extractor
 * that emits one task per AC bullet. Users compose with `omx team`
 * via standard shell pipes:
 *
 *     codexian spec team-tasks 4 --format json | jq '.[] | .title'
 *     codexian spec team-tasks 4 --format ndjson | while read t; do ... done
 *
 * No coupling to OMX team internals.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { locateSpecDir } from './locate.js';

export interface TeamTaskCandidate {
  /** Identifier from the CONTEXT bullet, e.g. "AC-1". */
  id: string;
  /** One-line summary derived from the bullet body. */
  title: string;
  /** Full bullet body text after the id. */
  body: string;
  /** Phase number this task came from. */
  phase: number;
}

export interface TeamTasksOptions {
  cwd?: string;
  phase: number;
}

export class TeamTasksError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TeamTasksError';
  }
}

const AC_BULLET_RE = /^[ \t]*-[ \t]+(AC-\d+):[ \t]*([^\n]+)$/gm;

/**
 * Extract Acceptance-criteria bullets from CONTEXT.phase-N.md and
 * shape them as candidate team tasks. Each AC becomes one task.
 */
export function extractTeamTasks(opts: TeamTasksOptions): TeamTaskCandidate[] {
  const cwd = opts.cwd ?? process.cwd();
  const located = locateSpecDir(cwd);
  if (!located) {
    throw new TeamTasksError(
      `No spec directory found in ${cwd}. Run \`codexian spec init\` first.`,
    );
  }
  const ctxPath = join(located.dir, `CONTEXT.phase-${opts.phase}.md`);
  if (!existsSync(ctxPath)) {
    throw new TeamTasksError(
      `CONTEXT.phase-${opts.phase}.md not found at ${ctxPath}. Run \`codexian spec new-phase ${opts.phase} "<name>"\` first.`,
    );
  }
  const text = readFileSync(ctxPath, 'utf8');
  const accSection = extractSection(text, 'Acceptance criteria');
  if (!accSection) {
    throw new TeamTasksError(
      `CONTEXT.phase-${opts.phase}.md has no "## Acceptance criteria" section.`,
    );
  }

  const out: TeamTaskCandidate[] = [];
  const matches = accSection.matchAll(AC_BULLET_RE);
  for (const m of matches) {
    const id = m[1].trim();
    const body = m[2].trim();
    // Title = body truncated at the first sentence boundary outside
    // identifier-like dotted tokens (e.g. "record-verify-failure.ts"
    // should not split). Cheap heuristic: split on ". " or "; " or
    // an em-dash followed by space, else use first 120 chars.
    const split = body.search(/(\. |; | — |$)/);
    let title = split > 0 ? body.slice(0, split) : body;
    if (title.length > 120) title = `${title.slice(0, 117)}...`;
    out.push({ id, title: title.trim(), body, phase: opts.phase });
  }
  return out;
}

function extractSection(text: string, heading: string): string | null {
  const re = new RegExp(`^##\\s+${escape(heading)}\\s*$`, 'mi');
  const m = text.match(re);
  if (!m || m.index == null) return null;
  const after = text.slice(m.index + m[0].length);
  const next = after.search(/^##\s+\S/m);
  return next >= 0 ? after.slice(0, next) : after;
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface FormatOptions {
  format: 'human' | 'json' | 'ndjson' | 'team-create';
}

/**
 * Format extracted tasks for a downstream consumer.
 *
 * - human:       readable bullet list with id + title + body
 * - json:        single JSON array of TeamTaskCandidate
 * - ndjson:      one JSON object per line (pipes to `while read`)
 * - team-create: shell snippets that pipe to `omx team api create-task`
 *                (the user copies the output, reviews, and runs)
 */
export function formatTeamTasks(
  tasks: readonly TeamTaskCandidate[],
  opts: FormatOptions,
): string {
  switch (opts.format) {
    case 'human': {
      const lines: string[] = [];
      for (const t of tasks) {
        lines.push(`${t.id} (phase ${t.phase}): ${t.title}`);
        if (t.body !== t.title) lines.push(`  ${t.body}`);
        lines.push('');
      }
      return lines.join('\n').trimEnd();
    }
    case 'json':
      return JSON.stringify(tasks, null, 2);
    case 'ndjson':
      return tasks.map((t) => JSON.stringify(t)).join('\n');
    case 'team-create': {
      const lines: string[] = [
        '# codexian spec team-tasks — preview, review before running',
        `# Phase ${tasks[0]?.phase ?? '?'} acceptance criteria → team tasks`,
        '',
      ];
      for (const t of tasks) {
        const payload = {
          team_name: '<TEAM_NAME>',
          subject: `${t.id}: ${t.title}`,
          description: t.body,
        };
        lines.push(
          `omx team api create-task --input '${JSON.stringify(payload)}' --json`,
        );
      }
      return lines.join('\n');
    }
  }
}
