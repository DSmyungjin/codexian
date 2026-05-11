import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import {
  DOC_KIND_SPECS,
  DOC_MARKER_PREFIX,
  KIND_MARKER_PREFIX,
  REQUIRED_DOCS,
  SCHEMA_MARKER_PREFIX,
  SCHEMA_VERSION,
  inferKindFromFilename,
  type DocKind,
  type DocType,
} from './contract.js';
import {
  computeCoverage,
  extractDecisionIds,
  resolvePlanDecisionRefs,
} from './decisions.js';
import { locateSpecDir } from './locate.js';

export interface ValidationIssue {
  file: string;
  level: 'error' | 'warning';
  message: string;
}

export interface ValidationReport {
  ok: boolean;
  specDir: string | null;
  issues: ValidationIssue[];
}

const REQUIRED_DOC_TYPES: Record<string, DocType> = {
  'PROJECT.md': 'PROJECT',
  'REQUIREMENTS.md': 'REQUIREMENTS',
  'ROADMAP.md': 'ROADMAP',
  'STATE.md': 'STATE',
};

const TODO_PLACEHOLDER = /_TODO[^_]*_/;

export function validate(cwd: string = process.cwd()): ValidationReport {
  const located = locateSpecDir(cwd);
  if (!located) {
    return {
      ok: false,
      specDir: null,
      issues: [
        {
          file: '.',
          level: 'error',
          message:
            'No spec directory found. Run `codexian spec init` to scaffold one.',
        },
      ],
    };
  }

  const issues: ValidationIssue[] = [];

  for (const name of REQUIRED_DOCS) {
    const full = join(located.dir, name);
    if (!existsSync(full)) {
      issues.push({ file: name, level: 'error', message: 'Missing required spec doc.' });
      continue;
    }
    const text = readFileSync(full, 'utf8');
    issues.push(...checkDoc(name, text));
  }

  const state = join(located.dir, 'STATE.md');
  let currentPhase: number | null = null;
  if (existsSync(state)) {
    const text = readFileSync(state, 'utf8');
    const m = text.match(/^\s*current_phase:\s*(\d+)\s*$/m);
    if (!m) {
      issues.push({
        file: 'STATE.md',
        level: 'error',
        message: 'STATE.md is missing a "current_phase: <N>" line. The session-start hook needs this to load the right CONTEXT.',
      });
    } else {
      currentPhase = Number.parseInt(m[1], 10);
    }
  }

  // Strict check: the CONTEXT file for the current phase, if present,
  // must satisfy the DECISIONS kind rules. This catches the case where
  // a fresh new-phase scaffolds a CONTEXT.phase-N.md full of _TODO_
  // placeholders and the user advances to it without running
  // $spec-discuss — previously validate would still report OK and the
  // executor would happily proceed with empty decisions.
  if (currentPhase != null && currentPhase > 0) {
    const ctxName = `CONTEXT.phase-${currentPhase}.md`;
    const ctxPath = join(located.dir, ctxName);
    if (existsSync(ctxPath)) {
      const ctxText = readFileSync(ctxPath, 'utf8');
      issues.push(...checkDoc(ctxName, ctxText));
      issues.push(...checkDecisionCoverage(located.dir, currentPhase, ctxText));
    }
    // If the CONTEXT for the current phase is missing, surface that —
    // the session-start hook will silently skip it, leaving agents
    // without phase decisions.
    else {
      issues.push({
        file: ctxName,
        level: 'warning',
        message: `Current phase is ${currentPhase} but ${ctxName} does not exist. Run \`codexian spec new-phase ${currentPhase} "<name>"\` to scaffold it.`,
      });
    }

    issues.push(...checkPlanCheckMarker(located.dir, currentPhase));
  }

  const errors = issues.filter((i) => i.level === 'error');
  return { ok: errors.length === 0, specDir: located.dir, issues };
}

function checkDoc(name: string, text: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Legacy SPEC:DOC marker check (back-compat with v1).
  const expectedType = REQUIRED_DOC_TYPES[name];
  if (expectedType && !text.includes(`${DOC_MARKER_PREFIX}${expectedType} -->`)) {
    issues.push({
      file: name,
      level: 'error',
      message: `Missing or wrong doc-type marker. Expected "${DOC_MARKER_PREFIX}${expectedType} -->".`,
    });
  }

  // schema_version marker.
  if (!text.includes(SCHEMA_MARKER_PREFIX)) {
    issues.push({ file: name, level: 'warning', message: 'Missing schema_version marker.' });
  } else {
    const m = text.match(/<!--\s*schema_version:\s*(\d+)\s*-->/);
    if (m && Number.parseInt(m[1], 10) !== SCHEMA_VERSION) {
      issues.push({
        file: name,
        level: 'warning',
        message: `schema_version is ${m[1]}, expected ${SCHEMA_VERSION}.`,
      });
    }
  }

  // Taxonomy: kind marker presence and consistency.
  const declaredKind = parseKindMarker(text);
  const inferredKind = inferKindFromFilename(name);
  if (!declaredKind) {
    issues.push({
      file: name,
      level: 'warning',
      message: `Missing "${KIND_MARKER_PREFIX} <kind> -->" marker. Agents rely on this to know how to treat the doc.`,
    });
  } else if (inferredKind && declaredKind !== inferredKind) {
    issues.push({
      file: name,
      level: 'error',
      message: `Declared kind "${declaredKind}" does not match inferred kind "${inferredKind}" from filename.`,
    });
  }

  // Apply per-kind rules.
  const kind = declaredKind ?? inferredKind;
  if (kind) {
    issues.push(...checkKindRules(name, text, kind));
  }

  return issues;
}

function checkKindRules(name: string, text: string, kind: DocKind): ValidationIssue[] {
  const spec = DOC_KIND_SPECS[kind];
  const issues: ValidationIssue[] = [];

  // Forcing-function docs: required sections must not contain template placeholders.
  if (spec.isForcingFunction) {
    for (const section of spec.requiredSections) {
      const body = extractSectionBody(text, section);
      if (body == null) {
        issues.push({
          file: name,
          level: 'warning',
          message: `Forcing-function doc is missing required section "## ${section}".`,
        });
        continue;
      }
      const trimmed = body.trim();
      if (!trimmed) {
        issues.push({
          file: name,
          level: 'error',
          message: `Required section "## ${section}" is empty. Forcing-function docs cannot pass validation with empty required sections.`,
        });
      } else if (TODO_PLACEHOLDER.test(trimmed)) {
        issues.push({
          file: name,
          level: 'error',
          message: `Required section "## ${section}" still contains a _TODO_ placeholder. Replace it with a real decision before this doc is considered spec-complete.`,
        });
      }
    }
  }

  // Size budget warning for always-loaded docs.
  if (spec.loadPolicy === 'always' && Number.isFinite(spec.sizeBudgetLines)) {
    const lines = text.split('\n').length;
    if (lines > spec.sizeBudgetLines) {
      issues.push({
        file: name,
        level: 'warning',
        message: `Always-loaded doc has ${lines} lines, exceeding the ${spec.sizeBudgetLines}-line budget for ${kind}. Consider tightening to keep session-start context lean.`,
      });
    }
  }

  return issues;
}

/**
 * Decision-ID coverage gate. Enforces D-01..D-05 of phase 2 of codexian's
 * own spec contract: every D-NN declared in CONTEXT.phase-N.md must be
 * referenced inside the plan for that phase. Plan source is
 * `.codexian/spec/plans/phase-N.PLAN.md` (canonical, since phase 4
 * chunk 2) with a fallback to legacy ROADMAP SPEC:PLAN markers.
 *
 * No-ops when:
 *  - CONTEXT has no D-IDs (nothing to gate against)
 *  - No plan surface exists for this phase yet (D-04 from phase 2)
 */
function checkDecisionCoverage(
  specDir: string,
  phase: number,
  contextText: string,
): ValidationIssue[] {
  const decisions = extractDecisionIds(contextText);
  if (decisions.length === 0) return [];

  const planRefs = resolvePlanDecisionRefs(specDir, phase);
  if (planRefs == null) return [];

  const { missing, extra } = computeCoverage(decisions, planRefs);
  const issues: ValidationIssue[] = [];
  const ctxName = `CONTEXT.phase-${phase}.md`;
  const planFileRel = `plans/phase-${phase}.PLAN.md`;
  const planFileAbsent = !existsSync(join(specDir, planFileRel));
  const planLocation = planFileAbsent
    ? 'the SPEC:PLAN markers in ROADMAP.md (legacy)'
    : `${planFileRel}`;

  if (missing.length > 0) {
    issues.push({
      file: ctxName,
      level: 'error',
      message: `Plan for phase ${phase} is missing references to decisions: ${missing.join(', ')}. Every D-NN in CONTEXT must be mentioned in ${planLocation}.`,
    });
  }
  if (extra.length > 0) {
    issues.push({
      file: planFileAbsent ? 'ROADMAP.md' : planFileRel,
      level: 'warning',
      message: `Plan for phase ${phase} references decision IDs not declared in ${ctxName}: ${extra.join(', ')}. Either add them to CONTEXT or correct the plan.`,
    });
  }
  return issues;
}

/**
 * Plan-checker marker WARN (phase 4 chunk 3, D-14).
 *
 * When `plans/phase-N.PLAN.md` exists for the current phase and lacks
 * the `<!-- spec:plan-check: approved -->` marker, surface an advisory
 * warning. The hard rejection lives in the $spec-plan skill prompt;
 * validate's job is to flag a missing marker so the next agent sees it.
 *
 * Sealed phases (ROADMAP status `[x]`) are exempt — those plans predate
 * the gate and rewriting them would mutate immutable history.
 */
function checkPlanCheckMarker(
  specDir: string,
  phase: number,
): ValidationIssue[] {
  const planRel = `plans/phase-${phase}.PLAN.md`;
  const planPath = join(specDir, planRel);
  if (!existsSync(planPath)) return [];

  // Sealed-phase exemption.
  const roadmapPath = join(specDir, 'ROADMAP.md');
  if (existsSync(roadmapPath)) {
    const roadmap = readFileSync(roadmapPath, 'utf8');
    if (isPhaseSealed(roadmap, phase)) return [];
  }

  const planText = readFileSync(planPath, 'utf8');
  if (/<!--\s*spec:plan-check:\s*approved\s*-->/.test(planText)) return [];

  return [
    {
      file: planRel,
      level: 'warning',
      message: `Plan for phase ${phase} is missing the architect approval marker. After $spec-plan ${phase} produces an approved plan, the marker block (\`<!-- spec:plan-check: approved -->\`) should sit at the top of the file. Re-run $spec-plan ${phase} or add the marker manually if the plan was authored before the gate landed.`,
    },
  ];
}

/**
 * Detect whether ROADMAP.md marks `phase` with status `[x]`.
 * Robust to multiple phases — only the entry whose `### Phase N:` header
 * matches counts.
 */
function isPhaseSealed(roadmapText: string, phase: number): boolean {
  const lines = roadmapText.split('\n');
  const headerRe = new RegExp(`^###\\s+Phase\\s+${phase}\\b`);
  let inPhase = false;
  for (const line of lines) {
    if (headerRe.test(line)) {
      inPhase = true;
      continue;
    }
    if (inPhase) {
      if (/^###\s+/.test(line)) return false; // next phase reached without a Status flip
      const m = line.match(/^-\s+\*\*Status:\*\*\s+`(\[.\])`/);
      if (m) return m[1] === '[x]';
    }
  }
  return false;
}

function parseKindMarker(text: string): DocKind | null {
  const m = text.match(/<!--\s*spec:kind:\s*([A-Z]+)\s*-->/);
  if (!m) return null;
  const candidate = m[1] as DocKind;
  if (candidate in DOC_KIND_SPECS) return candidate;
  return null;
}

function extractSectionBody(text: string, headingTitle: string): string | null {
  // Find a `## <heading>` line, then capture everything until the next `## ` heading
  // or end of file. Case-insensitive match on the heading text itself.
  const lines = text.split('\n');
  const re = new RegExp(`^##\\s+${escapeRegex(headingTitle)}\\s*$`, 'i');
  let i = 0;
  for (; i < lines.length; i++) {
    if (re.test(lines[i])) {
      i++;
      break;
    }
  }
  if (i >= lines.length) return null;
  const collected: string[] = [];
  for (; i < lines.length; i++) {
    if (/^##\s+\S/.test(lines[i])) break;
    // Skip HTML comments which are template hints, not content.
    if (/^\s*<!--/.test(lines[i]) && /-->\s*$/.test(lines[i])) continue;
    collected.push(lines[i]);
  }
  return collected.join('\n');
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}
