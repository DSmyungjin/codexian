import { existsSync } from 'fs';
import { isAbsolute, join } from 'path';

import { SPEC_DIR, SPEC_DIR_FALLBACKS, type SpecLocation } from './contract.js';

/**
 * Walk the candidate spec-dir names against `root` and return the first
 * one that exists. Returns null if none exist.
 */
export function locateSpecDir(root: string): SpecLocation | null {
  const candidates = [SPEC_DIR, ...SPEC_DIR_FALLBACKS];
  for (const rel of candidates) {
    const dir = isAbsolute(rel) ? rel : join(root, rel);
    if (existsSync(dir)) return { dir, relative: rel };
  }
  return null;
}

export function defaultSpecDir(root: string): SpecLocation {
  return { dir: join(root, SPEC_DIR), relative: SPEC_DIR };
}
