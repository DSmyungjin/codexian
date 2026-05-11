/**
 * codexian spec-contract — active workflow detector.
 *
 * The seal × ralph/team interlock (C4 from the Ralph/Team analysis):
 * before snapshotting a phase, check whether any ralph session or
 * team manifest under `.omx/state/` is still in a non-terminal state.
 * Sealing during active work risks LEDGER inconsistency — the snapshot
 * captures a moment that ralph/team then mutates further.
 *
 * Heuristics are deliberately permissive (best-effort, no strict
 * dependency on OMX internals):
 *   - Ralph session counts as active when current_phase is one of
 *     {starting, executing, verifying, fixing}. Terminal phases
 *     (complete, failed, cancelled, blocked_on_user) are excluded.
 *   - Team counts as active when a team-state directory exists for
 *     it; finer worker-status inspection is left to OMX's own
 *     team status command.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const RALPH_ACTIVE_PHASES = new Set([
  'starting',
  'executing',
  'verifying',
  'fixing',
]);

export interface ActiveRalph {
  sessionId: string;
  currentPhase: string;
  startedAt?: string;
  updatedAt?: string;
  statePath: string;
}

export interface ActiveTeam {
  teamName: string;
  manifestPath: string | null;
}

export interface ActiveWorkflows {
  ralph: ActiveRalph[];
  team: ActiveTeam[];
}

export function findActiveWorkflows(cwd: string): ActiveWorkflows {
  return {
    ralph: findActiveRalphSessions(cwd),
    team: findActiveTeams(cwd),
  };
}

function findActiveRalphSessions(cwd: string): ActiveRalph[] {
  const sessionsRoot = join(cwd, '.omx', 'state', 'sessions');
  if (!existsSync(sessionsRoot)) return [];
  let entries: string[];
  try {
    entries = readdirSync(sessionsRoot);
  } catch {
    return [];
  }
  const out: ActiveRalph[] = [];
  for (const sessionId of entries) {
    const statePath = join(sessionsRoot, sessionId, 'ralph-state.json');
    if (!existsSync(statePath)) continue;
    try {
      const raw = readFileSync(statePath, 'utf8');
      const data = JSON.parse(raw) as Record<string, unknown>;
      const phase = typeof data.current_phase === 'string' ? data.current_phase : null;
      if (phase && RALPH_ACTIVE_PHASES.has(phase)) {
        out.push({
          sessionId,
          currentPhase: phase,
          startedAt: typeof data.started_at === 'string' ? data.started_at : undefined,
          updatedAt: typeof data.updated_at === 'string' ? data.updated_at : undefined,
          statePath,
        });
      }
    } catch {
      // Malformed state file — skip silently; this is a best-effort detector.
      continue;
    }
  }
  return out;
}

function findActiveTeams(cwd: string): ActiveTeam[] {
  const teamsRoot = join(cwd, '.omx', 'state', 'team');
  if (!existsSync(teamsRoot)) return [];
  let entries: string[];
  try {
    entries = readdirSync(teamsRoot);
  } catch {
    return [];
  }
  const out: ActiveTeam[] = [];
  for (const teamName of entries) {
    const teamDir = join(teamsRoot, teamName);
    try {
      if (!statSync(teamDir).isDirectory()) continue;
    } catch {
      continue;
    }
    const manifestPath = join(teamDir, 'manifest.json');
    out.push({
      teamName,
      manifestPath: existsSync(manifestPath) ? manifestPath : null,
    });
  }
  return out;
}

export function summariseActiveWorkflows(active: ActiveWorkflows): string[] {
  const lines: string[] = [];
  for (const r of active.ralph) {
    lines.push(
      `ralph session ${r.sessionId} is ${r.currentPhase}` +
        (r.updatedAt ? ` (updated ${r.updatedAt})` : ''),
    );
  }
  for (const t of active.team) {
    lines.push(
      `team "${t.teamName}" has a live state directory` +
        (t.manifestPath ? ` (manifest: ${t.manifestPath})` : ' (no manifest)'),
    );
  }
  return lines;
}

export function hasAnyActive(active: ActiveWorkflows): boolean {
  return active.ralph.length > 0 || active.team.length > 0;
}
