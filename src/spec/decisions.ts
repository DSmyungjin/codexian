/**
 * codexian spec-contract — Decision ID extraction and coverage gate.
 *
 * Decisions in CONTEXT.phase-N.md are tagged inline with IDs of the form
 * `D-NN` (zero-padded, min 2 digits). Plans embedded in ROADMAP.md
 * between `<!-- SPEC:PLAN:START phase-N -->` / `END` markers must
 * mention every CONTEXT D-ID at least once. The validator uses this
 * module to enforce that contract.
 */

/** Matches a single Decision ID like "D-01", "D-12", "D-101". */
export const DECISION_ID_RE = /\bD-\d{2,}\b/g;

/**
 * Extract unique Decision IDs from a CONTEXT body, in first-occurrence
 * order. Duplicates within the text are coalesced.
 */
export function extractDecisionIds(text: string): string[] {
  return uniqueOrdered(text.match(DECISION_ID_RE) ?? []);
}

/**
 * Extract unique Decision IDs referenced inside the PLAN section for
 * `phase` in a ROADMAP body. Returns `null` when no plan section exists
 * for that phase (so the caller can distinguish "unplanned" from
 * "planned but empty of decisions").
 */
export function extractPlanDecisionRefs(
  roadmapText: string,
  phase: number,
): string[] | null {
  const startMarker = `<!-- SPEC:PLAN:START phase-${phase} -->`;
  const endMarker = `<!-- SPEC:PLAN:END phase-${phase} -->`;
  const startIdx = roadmapText.indexOf(startMarker);
  if (startIdx < 0) return null;
  const bodyStart = startIdx + startMarker.length;
  const endIdx = roadmapText.indexOf(endMarker, bodyStart);
  const body =
    endIdx < 0
      ? roadmapText.slice(bodyStart)
      : roadmapText.slice(bodyStart, endIdx);
  return uniqueOrdered(body.match(DECISION_ID_RE) ?? []);
}

export interface CoverageResult {
  /** IDs declared in CONTEXT but never referenced by the plan. */
  missing: string[];
  /** IDs referenced by the plan but not declared in CONTEXT. */
  extra: string[];
}

/** Set-difference both ways, preserving input order on each side. */
export function computeCoverage(
  decisions: readonly string[],
  planRefs: readonly string[],
): CoverageResult {
  const decisionSet = new Set(decisions);
  const planSet = new Set(planRefs);
  return {
    missing: decisions.filter((id) => !planSet.has(id)),
    extra: planRefs.filter((id) => !decisionSet.has(id)),
  };
}

function uniqueOrdered(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}
