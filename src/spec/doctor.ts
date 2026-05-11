import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { homedir } from 'os';
import { basename, join } from 'path';

import {
  CONTEXT_TEMPLATE,
  GENERATED_DIR,
  HOOK_FILENAME,
  REQUIRED_DOCS,
  SCHEMA_MARKER_PREFIX,
  SCHEMA_VERSION,
  SEALED_DIR,
} from './contract.js';
import { locateSpecDir } from './locate.js';

export type CheckStatus = 'PASS' | 'WARN' | 'FAIL' | 'INFO';

export interface CheckResult {
  name: string;
  status: CheckStatus;
  detail: string;
}

export interface DoctorReport {
  cwd: string;
  specDir: string | null;
  checks: CheckResult[];
  fails: number;
  warns: number;
}

const KNOWN_TOP_FILES = new Set<string>([
  ...REQUIRED_DOCS,
  CONTEXT_TEMPLATE,
]);

const KNOWN_TOP_DIRS = new Set<string>([
  GENERATED_DIR,
  SEALED_DIR,
  'hooks',
  'verify',
]);

const CONTEXT_PHASE_PATTERN = /^CONTEXT\.phase-\d+\.md$/;

function checkSpecDir(cwd: string): { located: string | null; checks: CheckResult[] } {
  const located = locateSpecDir(cwd);
  if (!located) {
    return {
      located: null,
      checks: [
        {
          name: 'spec directory',
          status: 'FAIL',
          detail: 'No spec directory found. Run `codexian spec init` to scaffold one.',
        },
      ],
    };
  }
  return {
    located: located.dir,
    checks: [
      { name: 'spec directory', status: 'PASS', detail: located.dir },
    ],
  };
}

function checkRequiredDocs(specDir: string): CheckResult[] {
  const out: CheckResult[] = [];
  for (const name of REQUIRED_DOCS) {
    const path = join(specDir, name);
    out.push(
      existsSync(path)
        ? { name: `required doc: ${name}`, status: 'PASS', detail: path }
        : { name: `required doc: ${name}`, status: 'FAIL', detail: `missing — ${path}` },
    );
  }
  return out;
}

function checkContextTemplate(specDir: string): CheckResult {
  const path = join(specDir, CONTEXT_TEMPLATE);
  return existsSync(path)
    ? { name: 'context template', status: 'PASS', detail: path }
    : {
        name: 'context template',
        status: 'WARN',
        detail: `missing — ${path}. \`codexian spec new-phase\` will fail until this is restored.`,
      };
}

function checkHook(specDir: string): CheckResult {
  const path = join(specDir, 'hooks', HOOK_FILENAME);
  if (!existsSync(path)) {
    return {
      name: 'session-start hook',
      status: 'WARN',
      detail: `missing — ${path}. Hook fallback to AGENTS.md mandatory-first-action still works.`,
    };
  }
  try {
    const mode = statSync(path).mode;
    if ((mode & 0o111) === 0) {
      return {
        name: 'session-start hook',
        status: 'WARN',
        detail: `present but not executable — ${path}. Run \`chmod +x\`.`,
      };
    }
  } catch {
    // fall through to PASS
  }
  return { name: 'session-start hook', status: 'PASS', detail: path };
}

function checkGenerated(specDir: string): CheckResult[] {
  const out: CheckResult[] = [];
  const dir = join(specDir, GENERATED_DIR);
  if (!existsSync(dir)) {
    out.push({
      name: 'generated/ slot',
      status: 'WARN',
      detail: `missing — ${dir}. \`$spec-map\` and \`$spec-patterns\` will lack a home.`,
    });
    return out;
  }
  out.push({ name: 'generated/ slot', status: 'PASS', detail: dir });
  for (const name of ['MAP.md', 'PATTERNS.md']) {
    const path = join(dir, name);
    out.push(
      existsSync(path)
        ? { name: `generated placeholder: ${name}`, status: 'PASS', detail: path }
        : {
            name: `generated placeholder: ${name}`,
            status: 'WARN',
            detail: `missing — ${path}. Owner skill will create on first invocation.`,
          },
    );
  }
  return out;
}

function checkSchemaConsistency(specDir: string): CheckResult[] {
  const out: CheckResult[] = [];
  const filesToCheck = REQUIRED_DOCS.map((n) => join(specDir, n));
  for (const path of filesToCheck) {
    if (!existsSync(path)) continue;
    const text = readFileSync(path, 'utf8');
    const m = text.match(/<!--\s*schema_version:\s*(\d+)\s*-->/);
    if (!m) {
      out.push({
        name: `schema_version in ${basename(path)}`,
        status: 'WARN',
        detail: `missing ${SCHEMA_MARKER_PREFIX} marker`,
      });
      continue;
    }
    const v = Number.parseInt(m[1], 10);
    if (v !== SCHEMA_VERSION) {
      out.push({
        name: `schema_version in ${basename(path)}`,
        status: 'WARN',
        detail: `is ${v}, current is ${SCHEMA_VERSION}. Consider running \`codexian spec init --force\` after backing up local edits.`,
      });
    }
  }
  return out;
}

function checkStrayFiles(specDir: string): CheckResult[] {
  const out: CheckResult[] = [];
  let entries: string[] = [];
  try {
    entries = readdirSync(specDir);
  } catch {
    return out;
  }
  const stray: string[] = [];
  for (const name of entries) {
    const full = join(specDir, name);
    let isDir = false;
    try {
      isDir = statSync(full).isDirectory();
    } catch {
      continue;
    }
    if (isDir) {
      if (!KNOWN_TOP_DIRS.has(name)) stray.push(`${name}/`);
      continue;
    }
    if (KNOWN_TOP_FILES.has(name)) continue;
    if (CONTEXT_PHASE_PATTERN.test(name)) continue;
    stray.push(name);
  }
  if (stray.length > 0) {
    out.push({
      name: 'stray files in spec dir',
      status: 'WARN',
      detail: `unknown entries: ${stray.join(', ')}. The spec contract does not recognise these. Move them or rename to a known shape.`,
    });
  } else {
    out.push({ name: 'stray files in spec dir', status: 'PASS', detail: 'no unknown entries' });
  }
  return out;
}

function checkAgentsHeritage(cwd: string): CheckResult {
  const path = join(cwd, 'AGENTS.md');
  if (!existsSync(path)) {
    return {
      name: 'project AGENTS.md heritage',
      status: 'WARN',
      detail:
        'no AGENTS.md at project root. Without it, Codex sessions will not auto-load the SPEC:CONTRACT directive. Create AGENTS.md and paste the SPEC:CONTRACT block from the codexian template.',
    };
  }
  const text = readFileSync(path, 'utf8');
  const hasStart = text.includes('<!-- SPEC:CONTRACT:START -->');
  const hasEnd = text.includes('<!-- SPEC:CONTRACT:END -->');
  const hasMandatory = text.includes('Mandatory first action');
  if (hasStart && hasEnd && hasMandatory) {
    return {
      name: 'project AGENTS.md heritage',
      status: 'PASS',
      detail: 'SPEC:CONTRACT block with Mandatory first action present',
    };
  }
  if (hasStart && hasEnd) {
    return {
      name: 'project AGENTS.md heritage',
      status: 'WARN',
      detail:
        'SPEC:CONTRACT markers present but Mandatory first action directive is missing. Update the block from the current template.',
    };
  }
  return {
    name: 'project AGENTS.md heritage',
    status: 'WARN',
    detail:
      'AGENTS.md exists but has no SPEC:CONTRACT block. Without it, Codex sessions will not be told to read the spec on first turn.',
  };
}

function checkOwnerSkills(cwd: string): CheckResult {
  // Best-effort: check the four most common locations a Codex install might put skills.
  const candidates = [
    join(cwd, '.codex', 'skills'),
    join(cwd, '.claude', 'skills'),
    join(homedir(), '.codex', 'skills'),
    join(homedir(), '.claude', 'skills'),
  ];
  const expected = [
    'spec-discuss', 'spec-plan', 'spec-roadmap', 'spec-seal',
    'spec-state-update', 'spec-map', 'spec-patterns', 'spec-verify',
  ];
  for (const dir of candidates) {
    if (!existsSync(dir)) continue;
    try {
      const entries = new Set(readdirSync(dir));
      const present = expected.filter((s) => entries.has(s));
      if (present.length === expected.length) {
        return {
          name: 'owner skills installed',
          status: 'PASS',
          detail: `all ${expected.length} spec-* skills found under ${dir}`,
        };
      }
      if (present.length > 0) {
        const missing = expected.filter((s) => !entries.has(s));
        return {
          name: 'owner skills installed',
          status: 'WARN',
          detail: `${present.length}/${expected.length} spec-* skills under ${dir}; missing: ${missing.join(', ')}. Re-run \`omx setup\` to refresh.`,
        };
      }
    } catch {
      continue;
    }
  }
  return {
    name: 'owner skills installed',
    status: 'INFO',
    detail: 'no Codex skills directory found in usual locations — skipping skill check',
  };
}

function summariseState(specDir: string): CheckResult[] {
  const out: CheckResult[] = [];
  const state = join(specDir, 'STATE.md');
  if (!existsSync(state)) return out;
  const text = readFileSync(state, 'utf8');
  const cp = text.match(/^\s*current_phase:\s*(\d+)\s*$/m);
  const ls = text.match(/^\s*last_sealed_phase:\s*(\d+)\s*$/m);
  if (cp) {
    out.push({ name: 'current phase', status: 'INFO', detail: cp[1] });
  }
  if (ls && Number.parseInt(ls[1], 10) > 0) {
    out.push({ name: 'last sealed phase', status: 'INFO', detail: ls[1] });
  }
  return out;
}

export function doctor(cwd: string = process.cwd()): DoctorReport {
  const { located, checks: dirChecks } = checkSpecDir(cwd);
  const checks: CheckResult[] = [...dirChecks];

  if (located) {
    checks.push(...checkRequiredDocs(located));
    checks.push(checkContextTemplate(located));
    checks.push(checkHook(located));
    checks.push(...checkGenerated(located));
    checks.push(...checkSchemaConsistency(located));
    checks.push(...checkStrayFiles(located));
  }

  checks.push(checkAgentsHeritage(cwd));
  checks.push(checkOwnerSkills(cwd));

  if (located) {
    checks.push(...summariseState(located));
  }

  const fails = checks.filter((c) => c.status === 'FAIL').length;
  const warns = checks.filter((c) => c.status === 'WARN').length;

  return { cwd, specDir: located, checks, fails, warns };
}

export function formatReport(report: DoctorReport): string {
  const lines: string[] = [];
  lines.push(`codexian spec doctor — ${report.cwd}`);
  if (report.specDir) lines.push(`spec dir: ${report.specDir}`);
  lines.push('');
  for (const c of report.checks) {
    const tag = c.status.padEnd(4);
    lines.push(`  [${tag}] ${c.name}: ${c.detail}`);
  }
  lines.push('');
  if (report.fails > 0) {
    lines.push(`${report.fails} FAIL, ${report.warns} WARN — fix the FAILs before relying on the spec contract.`);
  } else if (report.warns > 0) {
    lines.push(`${report.warns} WARN — installation usable but not pristine. Address warnings when you have a moment.`);
  } else {
    lines.push('OK — installation is healthy.');
  }
  return lines.join('\n');
}
