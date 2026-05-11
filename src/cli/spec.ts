import {
  doctor,
  formatReport,
  init,
  locateSpecDir,
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
  codexian spec seal <phase> [--note ...]  Snapshot STATE + CONTEXT for a phase into sealed/.
  codexian spec new-phase <N> <name>       Create CONTEXT.phase-N.md from the template.
  codexian spec inject                     Print the session-start context block (for shells).
  codexian spec where                      Print the active spec directory or "none".

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
        console.error('error: usage — codexian spec seal <phase> [--note "..."] [--force]');
        process.exit(1);
      }
      const note = args.named.get('note');
      const force = args.flags.has('--force');
      try {
        const result = seal({ cwd, phase, note, force });
        console.log(`sealed phase ${phase}`);
        console.log(`  state:   ${result.statePath}`);
        if (result.contextPath) console.log(`  context: ${result.contextPath}`);
        console.log(`  ledger:  ${result.ledgerPath}`);
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
    default:
      console.error(`unknown subcommand: ${sub}\n`);
      console.log(USAGE);
      process.exit(1);
  }
}
