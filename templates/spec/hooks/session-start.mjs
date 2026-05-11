#!/usr/bin/env node
// codexian spec-contract session-start hook.
//
// Loads .codexian/spec/{PROJECT,REQUIREMENTS,ROADMAP,STATE}.md plus the
// CONTEXT file for the current phase (derived from STATE.md) and emits a
// single concatenated context block on stdout. The Codex hook runner
// captures stdout and injects it into the session prompt.
//
// Idempotent and dependency-free: stdlib only. Silent when .codexian/spec/
// does not exist so a non-spec project is unaffected.

import { readFileSync, existsSync } from "node:fs";
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

function main() {
  const dir = findSpecDir(cwd);
  if (!dir) return;

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
    }
  }

  if (blocks.length === 0) return;

  process.stdout.write(
    [
      "<!-- codexian spec-contract: injected at session start -->",
      "<!-- These documents are the source of truth for project intent and position. -->",
      "",
      ...blocks.join("\n\n---\n\n").split("\n"),
      "",
      "<!-- end codexian spec-contract -->",
      "",
    ].join("\n"),
  );
}

main();
