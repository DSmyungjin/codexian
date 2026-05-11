#!/usr/bin/env node
// codexian spec-contract session-start hook.
//
// Codex's native hook protocol expects a JSON envelope on stdout:
//   { "hookSpecificOutput": { "hookEventName": "SessionStart",
//                             "additionalContext": "<text>" } }
// Text in `additionalContext` is injected as implicit context for
// the session before the user's first turn.
//
// This hook concatenates .codexian/spec/{PROJECT,REQUIREMENTS,
// ROADMAP,STATE}.md plus the CONTEXT.phase-N.md and (since phase 4
// chunk 2) plans/phase-N.PLAN.md for the current phase, all derived
// from STATE.md's `current_phase: N` line. Then emits the envelope.
// Stdlib-only and silent when no spec dir or doc is present.

import { readFileSync, existsSync, writeSync } from "node:fs";
import path from "node:path";

const SPEC_DIR_CANDIDATES = [".codexian/spec", ".omx/spec", ".spec"];
const ALWAYS_LOAD = ["PROJECT.md", "REQUIREMENTS.md", "ROADMAP.md", "STATE.md"];

const cwd = process.env.CODEXIAN_PROJECT_ROOT ?? process.cwd();

function findSpecDir(root) {
  for (const candidate of SPEC_DIR_CANDIDATES) {
    const full = path.join(root, candidate);
    if (existsSync(full)) return full;
  }
  return null;
}

function readPhaseFromState(stateText) {
  const match = stateText.match(/^\s*current_phase:\s*(\d+)\s*$/m);
  return match ? Number.parseInt(match[1], 10) : null;
}

function loadFile(dir, name) {
  const full = path.join(dir, name);
  if (!existsSync(full)) return null;
  return readFileSync(full, "utf8");
}

function buildContext() {
  const dir = findSpecDir(cwd);
  if (!dir) return "";

  const blocks = [];
  for (const name of ALWAYS_LOAD) {
    const text = loadFile(dir, name);
    if (text) blocks.push(`## ${name}\n\n${text.trim()}`);
  }

  const stateText = loadFile(dir, "STATE.md");
  if (stateText) {
    const phase = readPhaseFromState(stateText);
    if (phase != null) {
      const ctxName = `CONTEXT.phase-${phase}.md`;
      const ctxText = loadFile(dir, ctxName);
      if (ctxText) blocks.push(`## ${ctxName}\n\n${ctxText.trim()}`);

      const planRel = path.join("plans", `phase-${phase}.PLAN.md`);
      const planText = loadFile(dir, planRel);
      if (planText) blocks.push(`## ${planRel}\n\n${planText.trim()}`);
    }
  }

  if (blocks.length === 0) return "";

  return [
    "<!-- codexian spec-contract: injected at session start -->",
    "<!-- Source of truth for project intent and position. -->",
    "",
    blocks.join("\n\n---\n\n"),
    "",
    "<!-- end codexian spec-contract -->",
  ].join("\n");
}

const additionalContext = buildContext();
if (additionalContext) {
  const envelope = {
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext,
    },
  };
  const buf = Buffer.from(JSON.stringify(envelope));
  // Synchronous write directly to fd 1 — never deadlocks on stream backpressure.
  let offset = 0;
  while (offset < buf.length) {
    offset += writeSync(1, buf, offset, buf.length - offset);
  }
}
// Hard exit so we never wait on stdin.
process.exit(0);
