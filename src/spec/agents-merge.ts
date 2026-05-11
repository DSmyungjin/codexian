/**
 * AGENTS.md heritage merge.
 *
 * The spec contract is only effective if Codex sessions auto-load the
 * "Mandatory first action" directive — and the canonical channel for
 * that on Codex CLI 0.130+ is the project-root AGENTS.md (since hooks
 * are currently affected by upstream regression).
 *
 * This module owns the merge:
 *   1. Read the SPEC:CONTRACT:START..END block from the shipped
 *      templates/AGENTS.md.
 *   2. In the target project root:
 *      - If no AGENTS.md → create minimal AGENTS.md with the block.
 *      - If AGENTS.md exists with the markers → replace the block.
 *      - If AGENTS.md exists without markers → append the block at end.
 *
 * Idempotent. Preserves all non-marker content.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const START_MARKER = '<!-- SPEC:CONTRACT:START -->';
const END_MARKER = '<!-- SPEC:CONTRACT:END -->';

const NEW_AGENTS_HEADER = `# AGENTS.md

> Project memory for Codex CLI. Codex auto-loads this file at session start.
> The codexian spec-contract block below is managed by \`codexian spec init\`
> and refreshed by re-running it. Do not edit between the SPEC:CONTRACT
> markers — edit the upstream template and re-run init instead.

`;

export type AgentsMergeAction = 'created' | 'replaced' | 'appended' | 'unchanged';

export interface AgentsMergeResult {
  path: string;
  action: AgentsMergeAction;
}

function templatesAgentsPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // dist/spec/agents-merge.js -> ../../templates/AGENTS.md
  return join(here, '..', '..', 'templates', 'AGENTS.md');
}

/**
 * Find the real SPEC:CONTRACT block in the template. The template
 * also mentions the marker tokens inside its documentation (e.g.
 * inside backtick examples). To avoid grabbing those, match the
 * markers only when they appear at the start of a line, preceded
 * only by whitespace.
 */
function findRealBlock(text: string): { start: number; end: number } | null {
  const startRe = /^[ \t]*<!--\s*SPEC:CONTRACT:START\s*-->/m;
  const endRe = /^[ \t]*<!--\s*SPEC:CONTRACT:END\s*-->/m;
  const startMatch = text.match(startRe);
  if (!startMatch || startMatch.index === undefined) return null;
  const afterStart = text.slice(startMatch.index + startMatch[0].length);
  const endMatch = afterStart.match(endRe);
  if (!endMatch || endMatch.index === undefined) return null;
  const endIndex =
    startMatch.index + startMatch[0].length + endMatch.index + endMatch[0].length;
  return { start: startMatch.index, end: endIndex };
}

function extractSpecBlock(): string {
  const path = templatesAgentsPath();
  if (!existsSync(path)) {
    throw new Error(
      `Template AGENTS.md not found at ${path}. The codexian install may be corrupted.`,
    );
  }
  const text = readFileSync(path, 'utf8');
  const block = findRealBlock(text);
  if (!block) {
    throw new Error(
      `Template AGENTS.md is missing a line-anchored SPEC:CONTRACT block. The codexian install is inconsistent.`,
    );
  }
  return text.slice(block.start, block.end);
}

export function mergeAgentsHeritage(
  cwd: string,
  options: { force?: boolean } = {},
): AgentsMergeResult {
  const path = join(cwd, 'AGENTS.md');
  const block = extractSpecBlock();

  if (!existsSync(path)) {
    writeFileSync(path, `${NEW_AGENTS_HEADER}${block}\n`, 'utf8');
    return { path, action: 'created' };
  }

  const current = readFileSync(path, 'utf8');
  const existing = findRealBlock(current);

  if (existing) {
    const before = current.slice(0, existing.start);
    const after = current.slice(existing.end);
    const next = `${before}${block}${after}`;
    if (next === current && !options.force) {
      return { path, action: 'unchanged' };
    }
    writeFileSync(path, next, 'utf8');
    return { path, action: 'replaced' };
  }

  // No markers — append at end with a separator.
  const sep = current.endsWith('\n') ? '\n' : '\n\n';
  writeFileSync(path, `${current}${sep}${block}\n`, 'utf8');
  return { path, action: 'appended' };
}
