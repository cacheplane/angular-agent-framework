#!/usr/bin/env node
// SPDX-License-Identifier: MIT

/**
 * Pure-function classifier for the cockpit-e2e matrix.
 *
 * @param {Array<{angular: string, python: string}>} allCockpitCaps
 *        All cockpit angular projects with an e2e target, paired with
 *        their python sibling path. Derived from the project graph by
 *        the CLI wrapper (or hard-coded in tests).
 * @param {Set<string>} affectedNames
 *        Set of project names nx-affected returned for this diff.
 * @param {{fullFleet: boolean}} opts
 *        fullFleet=true forces all caps regardless of affected. Set by
 *        the CLI on push events and on the empty-affected fallback.
 * @returns {Array<{angular: string, python: string}>}
 *        Caps to dispatch as matrix entries, preserving the order of
 *        `allCockpitCaps`.
 */
export function selectCockpitCaps(allCockpitCaps, affectedNames, { fullFleet }) {
  if (fullFleet) return allCockpitCaps;
  return allCockpitCaps.filter((cap) => affectedNames.has(cap.angular));
}

// ── CLI wrapper ────────────────────────────────────────────────────────────
// Only runs when invoked as a script (not when imported by tests).
import { execFileSync } from 'node:child_process';
import { appendFileSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

function parseArgs(argv) {
  const out = { base: null, head: null, fullFleet: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base') out.base = argv[++i];
    else if (a === '--head') out.head = argv[++i];
    else if (a === '--full-fleet') out.fullFleet = argv[++i] === 'true';
  }
  return out;
}

function nxJson(args) {
  const stdout = execFileSync('npx', ['nx', ...args, '--json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  return JSON.parse(stdout);
}

// Walk cockpit/ directly, finding every */angular/project.json. Reading
// project.json from disk is ~100x faster than `nx show project <name> --json`
// per project (no nx CLI overhead, no project graph compute).
//
// Each candidate is kept iff its project.json has a targets.e2e key.
// The python sibling path is derived by replacing /angular with /python in
// the directory path (convention: cockpit/<topic>/<cap>/{angular,python}).
function deriveCockpitCaps() {
  const repoRoot = path.resolve(fileURLToPath(import.meta.url), '..', '..');
  const cockpitDir = path.join(repoRoot, 'cockpit');
  const caps = [];

  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const full = path.join(dir, name);
      let s;
      try {
        s = statSync(full);
      } catch {
        continue;
      }
      if (!s.isDirectory()) continue;
      if (name === 'node_modules' || name.startsWith('.')) continue;

      // If this dir IS an angular project (matches /angular endpoint), check
      // for project.json; otherwise recurse.
      if (path.basename(full) === 'angular') {
        const projectJsonPath = path.join(full, 'project.json');
        try {
          const meta = JSON.parse(readFileSync(projectJsonPath, 'utf8'));
          if (!meta.targets?.e2e) continue;
          const angularName = meta.name;
          if (typeof angularName !== 'string') continue;
          // Derive python sibling: same parent dir, swap angular -> python.
          const relAngular = path.relative(repoRoot, full); // e.g. cockpit/chat/messages/angular
          const relPython = relAngular.replace(/\/angular$/, '/python');
          caps.push({ angular: angularName, python: relPython });
        } catch {
          // No project.json or invalid JSON — skip silently.
        }
        continue;
      }

      walk(full);
    }
  }

  walk(cockpitDir);
  caps.sort((a, b) => a.angular.localeCompare(b.angular));
  return caps;
}

function loadAffectedNames(base, head) {
  return new Set(
    nxJson(['show', 'projects', '--affected', `--base=${base}`, `--head=${head}`]),
  );
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const allCaps = deriveCockpitCaps();

  let affected;
  if (args.fullFleet) {
    affected = new Set();
  } else {
    affected = loadAffectedNames(args.base, args.head);
  }

  // Empty-affected fallback: when scope says e2e is required but nx
  // didn't attribute any cap (lib fanout), run all caps.
  const haveAnyCockpitAffected = allCaps.some((c) => affected.has(c.angular));
  const effectiveFullFleet = args.fullFleet || !haveAnyCockpitAffected;

  const selected = selectCockpitCaps(allCaps, affected, {
    fullFleet: effectiveFullFleet,
  });

  const json = JSON.stringify(selected);

  const ghOutput = process.env.GITHUB_OUTPUT;
  if (ghOutput) {
    appendFileSync(ghOutput, `caps=${json}\n`);
  } else {
    // Local-debug mode: print to stdout.
    process.stdout.write(`caps=${json}\n`);
  }
}

// Only invoke main when run directly, not when imported.
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
