import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import {
  DOC_MARKER_PREFIX,
  REQUIRED_DOCS,
  SCHEMA_MARKER_PREFIX,
  SCHEMA_VERSION,
  type DocType,
} from './contract.js';
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

const REQUIRED_TYPES: Record<string, DocType> = {
  'PROJECT.md': 'PROJECT',
  'REQUIREMENTS.md': 'REQUIREMENTS',
  'ROADMAP.md': 'ROADMAP',
  'STATE.md': 'STATE',
};

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
    const expectedType = REQUIRED_TYPES[name];
    if (!text.includes(`${DOC_MARKER_PREFIX}${expectedType} -->`)) {
      issues.push({
        file: name,
        level: 'error',
        message: `Missing or wrong doc-type marker. Expected "${DOC_MARKER_PREFIX}${expectedType} -->".`,
      });
    }
    if (!text.includes(SCHEMA_MARKER_PREFIX)) {
      issues.push({
        file: name,
        level: 'warning',
        message: `Missing schema_version marker.`,
      });
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
  }

  const state = join(located.dir, 'STATE.md');
  if (existsSync(state)) {
    const text = readFileSync(state, 'utf8');
    if (!/^\s*current_phase:\s*\d+\s*$/m.test(text)) {
      issues.push({
        file: 'STATE.md',
        level: 'error',
        message: 'STATE.md is missing a "current_phase: <N>" line. The session-start hook needs this to load the right CONTEXT.',
      });
    }
  }

  const errors = issues.filter((i) => i.level === 'error');
  return { ok: errors.length === 0, specDir: located.dir, issues };
}
