/**
 * codexian spec-contract — shared constants and types.
 *
 * The contract is intentionally tiny: 5 markdown files in a known
 * directory, each carrying a SPEC:DOC:<TYPE> marker so downstream
 * tools can identify them without parsing the body.
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

export function markerFor(type: DocType): string {
  return `${DOC_MARKER_PREFIX}${type} -->`;
}

export interface SpecLocation {
  /** Absolute path to the directory holding the spec docs. */
  dir: string;
  /** The relative form actually found, e.g. ".codexian/spec". */
  relative: string;
}
