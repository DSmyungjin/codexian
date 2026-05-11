/**
 * codexian spec-contract — shared constants and types.
 *
 * The contract is intentionally tiny: a small set of markdown files in a
 * known directory, each carrying a SPEC:DOC:<TYPE> marker plus
 * machine-readable kind metadata so downstream tools (and agents) can
 * identify and treat each document according to its kind without parsing
 * the body.
 *
 * The DocKind taxonomy here is the *typed documentation discipline* — it
 * is the codexian equivalent of a type system for project docs. Every
 * doc declares its kind, and the validator + skills + hooks enforce the
 * rules for that kind.
 */

export const SCHEMA_VERSION = 1;

export const SPEC_DIR = '.codexian/spec';
export const SPEC_DIR_FALLBACKS = ['.omx/spec', '.spec'];

export const REQUIRED_DOCS = [
  'PROJECT.md',
  'REQUIREMENTS.md',
  'ROADMAP.md',
  'STATE.md',
] as const;

export const CONTEXT_TEMPLATE = 'CONTEXT.template.md';
export const SEALED_DIR = 'sealed';
export const GENERATED_DIR = 'generated';
export const HOOK_FILENAME = 'session-start.mjs';

export type RequiredDoc = (typeof REQUIRED_DOCS)[number];

export type DocType =
  | 'PROJECT'
  | 'REQUIREMENTS'
  | 'ROADMAP'
  | 'STATE'
  | 'CONTEXT';

export const DOC_MARKER_PREFIX = '<!-- SPEC:DOC:';
export const SCHEMA_MARKER_PREFIX = '<!-- schema_version:';
export const KIND_MARKER_PREFIX = '<!-- spec:kind:';

export function markerFor(type: DocType): string {
  return `${DOC_MARKER_PREFIX}${type} -->`;
}

export interface SpecLocation {
  /** Absolute path to the directory holding the spec docs. */
  dir: string;
  /** The relative form actually found, e.g. ".codexian/spec". */
  relative: string;
}

// ─────────────────────────────────────────────────────────────────────
// Doc taxonomy — the typed documentation discipline.
// ─────────────────────────────────────────────────────────────────────

/**
 * The kind of a document. A doc's kind determines who writes it, when
 * it can change, how it is loaded, and which skill owns it.
 */
export type DocKind =
  | 'INTENT'      // PROJECT.md — vision, non-goals
  | 'SCOPE'       // REQUIREMENTS.md — what's in and out
  | 'ROADMAP'     // ROADMAP.md — ordered phases
  | 'POSITION'    // STATE.md — where we are right now
  | 'DECISIONS'   // CONTEXT.phase-N.md — per-phase decisions
  | 'PLAN'        // approved plan, currently embedded in ROADMAP markers
  | 'MAP'         // architecture map (generated)
  | 'PATTERNS'    // code patterns / conventions (generated)
  | 'HISTORY'     // sealed snapshots + ledger
  | 'VERIFY';     // verification reports (per phase)

export type DocAuthor = 'human' | 'agent' | 'interview' | 'executor' | 'system';
export type DocMutability = 'mutable' | 'frozen' | 'append-only' | 'regenerable';
export type DocLifecycle = 'project' | 'per-phase';
export type DocLoadPolicy = 'always' | 'phase-entry' | 'on-demand' | 'never';

export interface DocKindSpec {
  kind: DocKind;
  /** Who is expected to author updates. */
  author: DocAuthor;
  /** Allowed mutation pattern. Enforced by validator + skill prompts. */
  mutability: DocMutability;
  /** Whether this lives once per project or once per phase. */
  lifecycle: DocLifecycle;
  /** When the session-start hook (or runtime) should inject this doc. */
  loadPolicy: DocLoadPolicy;
  /**
   * If true, empty required sections are a hard error: the act of filling
   * the document forces a decision. Forcing-function docs cannot be
   * left in their template state and still pass validation.
   */
  isForcingFunction: boolean;
  /** Section headings (without leading `##`) that must be non-empty when forcing. */
  requiredSections: string[];
  /**
   * Soft budget in lines for the doc body. Used by the validator to warn
   * when always-loaded docs grow large enough to crowd the context
   * window. Not a hard limit; agents may exceed when justified.
   */
  sizeBudgetLines: number;
  /** Skill that owns updates for docs of this kind. Empty means "no owner skill yet". */
  ownerSkill: string;
  /** One-line description of the kind, used by validators and AGENTS.md. */
  summary: string;
}

export const DOC_KIND_SPECS: Record<DocKind, DocKindSpec> = {
  INTENT: {
    kind: 'INTENT',
    author: 'human',
    mutability: 'mutable',
    lifecycle: 'project',
    loadPolicy: 'always',
    isForcingFunction: true,
    requiredSections: ['Vision', 'Non-goals', 'Primary user'],
    sizeBudgetLines: 80,
    ownerSkill: '',
    summary: 'Vision, non-goals, primary user. The "north star." Changes rarely.',
  },
  SCOPE: {
    kind: 'SCOPE',
    author: 'human',
    mutability: 'mutable',
    lifecycle: 'project',
    loadPolicy: 'always',
    isForcingFunction: true,
    requiredSections: ['Functional requirements', 'Out of scope'],
    sizeBudgetLines: 150,
    ownerSkill: '',
    summary: 'Functional and non-functional requirements, out-of-scope items.',
  },
  ROADMAP: {
    kind: 'ROADMAP',
    author: 'interview',
    mutability: 'mutable',
    lifecycle: 'project',
    loadPolicy: 'always',
    isForcingFunction: true,
    requiredSections: ['Phases'],
    sizeBudgetLines: 200,
    ownerSkill: 'spec-roadmap',
    summary: 'Ordered list of phases with status, goal, acceptance, dependencies.',
  },
  POSITION: {
    kind: 'POSITION',
    author: 'executor',
    mutability: 'mutable',
    lifecycle: 'project',
    loadPolicy: 'always',
    isForcingFunction: false,
    requiredSections: ['Current phase'],
    sizeBudgetLines: 120,
    ownerSkill: 'spec-state-update',
    summary: 'Current phase and recent decisions. The only file that changes during normal work.',
  },
  DECISIONS: {
    kind: 'DECISIONS',
    author: 'interview',
    mutability: 'mutable',
    lifecycle: 'per-phase',
    loadPolicy: 'phase-entry',
    isForcingFunction: true,
    requiredSections: ['Acceptance criteria'],
    sizeBudgetLines: 200,
    ownerSkill: 'spec-discuss',
    summary: 'Per-phase implementation decisions captured before planning. Frozen on seal.',
  },
  PLAN: {
    kind: 'PLAN',
    author: 'agent',
    mutability: 'frozen',
    lifecycle: 'per-phase',
    loadPolicy: 'phase-entry',
    isForcingFunction: false,
    requiredSections: [],
    sizeBudgetLines: 300,
    ownerSkill: 'spec-plan',
    summary: 'Approved plan for a phase. Currently embedded in ROADMAP between SPEC:PLAN markers.',
  },
  MAP: {
    kind: 'MAP',
    author: 'agent',
    mutability: 'regenerable',
    lifecycle: 'project',
    loadPolicy: 'on-demand',
    isForcingFunction: false,
    requiredSections: [],
    sizeBudgetLines: 600,
    ownerSkill: 'spec-map',
    summary: 'Architecture / codebase map. Regenerable; do not hand-edit.',
  },
  PATTERNS: {
    kind: 'PATTERNS',
    author: 'agent',
    mutability: 'regenerable',
    lifecycle: 'project',
    loadPolicy: 'on-demand',
    isForcingFunction: false,
    requiredSections: [],
    sizeBudgetLines: 400,
    ownerSkill: 'spec-patterns',
    summary: 'Recurring code patterns / conventions. Regenerable; do not hand-edit.',
  },
  HISTORY: {
    kind: 'HISTORY',
    author: 'system',
    mutability: 'append-only',
    lifecycle: 'project',
    loadPolicy: 'never',
    isForcingFunction: false,
    requiredSections: [],
    sizeBudgetLines: Number.POSITIVE_INFINITY,
    ownerSkill: 'spec-seal',
    summary: 'Sealed snapshots and ledger. Append-only; sealed files are immutable.',
  },
  VERIFY: {
    kind: 'VERIFY',
    author: 'agent',
    mutability: 'frozen',
    lifecycle: 'per-phase',
    loadPolicy: 'on-demand',
    isForcingFunction: false,
    requiredSections: [],
    sizeBudgetLines: 200,
    ownerSkill: 'spec-verify',
    summary: 'Verification report for a phase. Frozen once produced.',
  },
};

/** Map filename patterns to their kinds for quick lookup. */
export const FILENAME_KIND_HINTS: { match: RegExp; kind: DocKind }[] = [
  { match: /^PROJECT\.md$/i, kind: 'INTENT' },
  { match: /^REQUIREMENTS\.md$/i, kind: 'SCOPE' },
  { match: /^ROADMAP\.md$/i, kind: 'ROADMAP' },
  { match: /^STATE\.md$/i, kind: 'POSITION' },
  { match: /^CONTEXT\.phase-\d+\.md$/i, kind: 'DECISIONS' },
  { match: /^CONTEXT\.template\.md$/i, kind: 'DECISIONS' },
  { match: /^MAP\.md$/i, kind: 'MAP' },
  { match: /^PATTERNS\.md$/i, kind: 'PATTERNS' },
  { match: /^sealed\//i, kind: 'HISTORY' },
  { match: /^LEDGER\.md$/i, kind: 'HISTORY' },
  { match: /^VERIFY\.phase-\d+\.md$/i, kind: 'VERIFY' },
];

export function inferKindFromFilename(name: string): DocKind | null {
  for (const hint of FILENAME_KIND_HINTS) {
    if (hint.match.test(name)) return hint.kind;
  }
  return null;
}
