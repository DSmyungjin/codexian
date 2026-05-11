import {
  doctor,
  formatReport,
  init,
  locateSpecDir,
  recordCompletion,
  RecordCompletionError,
  recordVerifyFailure,
  RecordVerifyFailureError,
  seal,
  SPEC_DIR,
  validate,
  writeContextDoc,
} from '../spec/index.js';

const USAGE = `codexian spec — documentation contract

Usage:
  codexian spec init                       Scaffold .codexian/spec/ from templates.
  codexian spec doctor                     Check installation integrity (files, hook, AGENTS.md, skills).
  codexian spec validate                   Lint the spec docs and report issues.
  codexian spec seal <phase> [--note ...] [--advance]
                                          Snapshot STATE + CONTEXT for a phase into sealed/.
                                          --advance also flips ROADMAP statuses and bumps current_phase.
  codexian spec new-phase <N> <name>       Create CONTEXT.phase-N.md from the template.
  codexian spec record-completion <slug> [--summary "..."] [--phase N] [--evidence "<paths>"]
                                          Record a completed unit of work in STATE.md.
                                          Connection surface for Ralph completion → POSITION doc.
  codexian spec record-verify-failure <slug> --fix-task "..." [--root-cause "..."] [--phase N] [--evidence "<paths>"]
                                          Record a verify-step failure in STATE.md: append fix task
                                          to Active work and a ledger line to Recent decisions.
                                          Idempotent by slug; call from $spec-verify on fail/partial.
  codexian spec inject                     Print the session-start context block (for shells).
  codexian spec where                      Print the active spec directory or "none".
  codexian spec exec [codex-flags] --prompt "<text>" [--dry-run]
                                          Codex CLI wrapper that prepends the spec contract
                                          context to the prompt, bypassing the SessionStart
                                          hook regression on Codex 0.129+. All non-prompt
                                          flags are forwarded verbatim to \`codex exec\`.

Options for init:
  --force        Overwrite existing spec files (default: skip).
  --no-agents    Skip merging the SPEC:CONTRACT block into project AGENTS.md.
  --cwd <dir>    Operate against <dir> instead of process.cwd().
`;

interface ParsedArgs {
  positional: string[];
  flags: Set<string>;
  named: Map<string, string>;
}

function parse(args: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags = new Set<string>();
  const named = new Map<string, string>();
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq >= 0) {
        named.set(a.slice(2, eq), a.slice(eq + 1));
      } else {
        const next = args[i + 1];
        if (next && !next.startsWith('-')) {
          named.set(a.slice(2), next);
          i++;
        } else {
          flags.add(a);
        }
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, flags, named };
}

export async function specCommand(rawArgs: string[]): Promise<void> {
  const [sub, ...rest] = rawArgs;
  if (!sub || sub === '--help' || sub === '-h' || sub === 'help') {
    console.log(USAGE);
    return;
  }
  const args = parse(rest);
  const cwd = args.named.get('cwd') ?? process.cwd();

  switch (sub) {
    case 'init': {
      const result = init({
        cwd,
        force: args.flags.has('--force'),
        noAgents: args.flags.has('--no-agents'),
      });
      console.log(`spec dir: ${result.specDir}`);
      if (result.created.length) {
        console.log(`created: ${result.created.length}`);
        for (const name of result.created) console.log(`  + ${name}`);
      }
      if (result.skipped.length) {
        console.log(`skipped (already exists, use --force to overwrite):`);
        for (const name of result.skipped) console.log(`  · ${name}`);
      }
      if (result.agents) {
        const a = result.agents;
        const verb = {
          created: 'created',
          replaced: 'refreshed SPEC:CONTRACT block in',
          appended: 'appended SPEC:CONTRACT block to',
          unchanged: 'no changes needed for',
        }[a.action];
        console.log(`AGENTS.md: ${verb} ${a.path}`);
      }
      console.log(`\nHook script: ${result.hookPath}`);
      console.log(
        `\nNext: edit ${SPEC_DIR}/PROJECT.md and run \`codexian spec validate\`.\n` +
          `Codex auto-loads AGENTS.md so the SPEC:CONTRACT directive is\n` +
          `already wired. (The hook script is opportunistic — used when\n` +
          `Codex's SessionStart hook regression is resolved upstream.)`,
      );
      return;
    }
    case 'validate': {
      const report = validate(cwd);
      if (!report.specDir) {
        console.error('error: no spec directory found. Run `codexian spec init` first.');
        process.exit(1);
      }
      console.log(`spec dir: ${report.specDir}`);
      if (report.issues.length === 0) {
        console.log('OK — no issues.');
        return;
      }
      let errors = 0;
      for (const issue of report.issues) {
        const tag = issue.level === 'error' ? 'ERROR' : 'WARN ';
        console.log(`  [${tag}] ${issue.file}: ${issue.message}`);
        if (issue.level === 'error') errors++;
      }
      if (errors > 0) process.exit(1);
      return;
    }
    case 'seal': {
      const phaseStr = args.positional[0];
      const phase = phaseStr ? Number.parseInt(phaseStr, 10) : NaN;
      if (!Number.isFinite(phase) || phase < 0) {
        console.error('error: usage — codexian spec seal <phase> [--note "..."] [--force] [--advance] [--ignore-active|--strict-active]');
        process.exit(1);
      }
      const note = args.named.get('note');
      const force = args.flags.has('--force');
      const advance = args.flags.has('--advance');
      const ignoreActive = args.flags.has('--ignore-active');
      const strictActive = args.flags.has('--strict-active');
      try {
        const result = seal({ cwd, phase, note, force, advance, ignoreActive, strictActive });
        if (result.activeAtSeal) {
          const lines: string[] = [];
          for (const r of result.activeAtSeal.ralph) {
            lines.push(`  ralph session ${r.sessionId} is ${r.currentPhase}`);
          }
          for (const t of result.activeAtSeal.team) {
            lines.push(`  team "${t.teamName}" has a live state directory`);
          }
          if (lines.length > 0) {
            console.warn('warning: active workflows detected at seal time (pass --strict-active to refuse, --ignore-active to skip the check):');
            for (const line of lines) console.warn(line);
            console.warn('');
          }
        }
        console.log(`sealed phase ${phase}`);
        console.log(`  state:   ${result.statePath}`);
        if (result.contextPath) console.log(`  context: ${result.contextPath}`);
        console.log(`  ledger:  ${result.ledgerPath}`);
        if (result.advanced) {
          const a = result.advanced;
          console.log(`advanced workflow:`);
          console.log(`  roadmap phase ${phase}: ${a.roadmapFlipped ? 'flipped to [x]' : 'not flipped (no matching status marker)'}`);
          if (a.toPhase != null) {
            console.log(`  roadmap phase ${a.toPhase}: ${a.nextRoadmapFlipped ? 'flipped to [~]' : 'present but no [ ] marker to flip'}`);
            console.log(`  state current_phase: ${phase} → ${a.toPhase}`);
          } else {
            console.log(`  no phase ${phase + 1} in ROADMAP — current_phase left unchanged`);
          }
        }
      } catch (err) {
        const e = err as Error;
        console.error(`error: ${e.message}`);
        process.exit(1);
      }
      return;
    }
    case 'new-phase': {
      const [nStr, ...nameParts] = args.positional;
      const n = nStr ? Number.parseInt(nStr, 10) : NaN;
      const name = nameParts.join(' ').trim();
      if (!Number.isFinite(n) || n < 1 || !name) {
        console.error('error: usage — codexian spec new-phase <N> <phase name>');
        process.exit(1);
      }
      const dest = writeContextDoc(cwd, n, name);
      console.log(`created: ${dest}`);
      console.log(`\nNext: run \`$spec-discuss ${n}\` inside Codex to populate this file.`);
      return;
    }
    case 'record-completion': {
      const slug = args.positional[0];
      if (!slug) {
        console.error('error: usage — codexian spec record-completion <slug> [--summary "..."] [--phase N] [--evidence "<paths>"]');
        process.exit(1);
      }
      const summary = args.named.get('summary');
      const phaseRaw = args.named.get('phase');
      const phase = phaseRaw ? Number.parseInt(phaseRaw, 10) : undefined;
      const evidenceRaw = args.named.get('evidence');
      const evidence = evidenceRaw
        ? evidenceRaw
            .split(/[,\s]+/)
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;
      try {
        const result = recordCompletion({ cwd, slug, summary, phase, evidence });
        console.log(`recorded completion: ${slug}`);
        console.log(`  state file:          ${result.statePath}`);
        console.log(`  recent decisions:    ${result.appendedRecentDecisions ? 'appended' : 'skipped (no ## Recent decisions section found)'}`);
        console.log(`  active work cleanup: ${result.changedActiveWork ? 'removed slug-matching bullet(s)' : 'nothing to clear'}`);
        console.log(`\n  ledger line:\n    ${result.ledgerLine}`);
      } catch (err) {
        if (err instanceof RecordCompletionError) {
          console.error(`error: ${err.message}`);
          process.exit(1);
        }
        throw err;
      }
      return;
    }
    case 'record-verify-failure': {
      const slug = args.positional[0];
      if (!slug) {
        console.error('error: usage — codexian spec record-verify-failure <slug> --fix-task "..." [--root-cause "..."] [--phase N] [--evidence "<paths>"]');
        process.exit(1);
      }
      const fixTask = args.named.get('fix-task');
      if (!fixTask) {
        console.error('error: --fix-task "<task title>" is required');
        process.exit(1);
      }
      const rootCause = args.named.get('root-cause');
      const phaseRaw = args.named.get('phase');
      const phase = phaseRaw ? Number.parseInt(phaseRaw, 10) : undefined;
      const evidenceRaw = args.named.get('evidence');
      const evidence = evidenceRaw
        ? evidenceRaw
            .split(/[,\s]+/)
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;
      try {
        const result = recordVerifyFailure({
          cwd,
          slug,
          fixTask,
          rootCause,
          phase,
          evidence,
        });
        console.log(`recorded verify failure: ${slug}`);
        console.log(`  state file:           ${result.statePath}`);
        if (result.suppressedDuplicate) {
          console.log(`  active work:          slug already present, no duplicate appended`);
        } else if (result.createdActiveWorkSection) {
          console.log(`  active work:          section created and bullet appended`);
        } else if (result.appendedActiveWork) {
          console.log(`  active work:          fix bullet appended`);
        }
        console.log(`  recent decisions:     ${result.appendedRecentDecisions ? 'ledger line appended' : 'skipped (no ## Recent decisions section found)'}`);
        console.log(`\n  bullet:\n    - ${result.bulletBody}`);
        console.log(`\n  ledger line:\n    ${result.ledgerLine}`);
      } catch (err) {
        if (err instanceof RecordVerifyFailureError) {
          console.error(`error: ${err.message}`);
          process.exit(1);
        }
        throw err;
      }
      return;
    }
    case 'inject': {
      const located = locateSpecDir(cwd);
      if (!located) {
        console.error('no spec directory found.');
        process.exit(1);
      }
      const { spawnSync } = await import('child_process');
      const { join } = await import('path');
      const hook = join(located.dir, 'hooks', 'session-start.mjs');
      const result = spawnSync(process.execPath, [hook], {
        cwd,
        stdio: ['ignore', 'inherit', 'inherit'],
      });
      if (result.status !== 0) process.exit(result.status ?? 1);
      return;
    }
    case 'where': {
      const located = locateSpecDir(cwd);
      console.log(located ? located.dir : 'none');
      return;
    }
    case 'doctor': {
      const report = doctor(cwd);
      console.log(formatReport(report));
      if (report.fails > 0) process.exit(1);
      return;
    }
    case 'exec': {
      // 'rest' is the raw arg list after `spec exec`; do not parse it
      // here so codex-exec passthrough flags survive untouched.
      const { execWrapper } = await import('../spec/index.js');
      const result = await execWrapper({ rawArgs: rest, cwd });
      if (result.code !== 0) process.exit(result.code);
      return;
    }
    default:
      console.error(`unknown subcommand: ${sub}\n`);
      console.log(USAGE);
      process.exit(1);
  }
}
