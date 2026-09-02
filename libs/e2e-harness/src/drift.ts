// SPDX-License-Identifier: MIT
// Diagnostic differ: compares recorded fixtures (arg 1: directory) against the
// committed fixtures directory. Prints a JSON DriftReport to stdout and a
// human summary to stderr. Exit code is ALWAYS 0 unless inputs are unreadable —
// the @drift e2e subset is the gate, not this script.
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { diffFixtures, type FixtureEntry } from './drift-lib';

function loadDir(dir: string): FixtureEntry[] {
  const out: FixtureEntry[] = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
    const parsed = JSON.parse(readFileSync(join(dir, f), 'utf-8')) as { fixtures?: FixtureEntry[] };
    for (const e of parsed.fixtures ?? []) out.push(e);
  }
  return out;
}

const recordedDir = process.argv[2];
const fixturesDir = process.argv[3];
if (!recordedDir || !fixturesDir) {
  console.error('usage: tsx drift.ts <recorded-fixtures-dir> <committed-fixtures-dir>');
  process.exit(1);
}
const FIXTURES_DIR = resolve(fixturesDir);

const report = diffFixtures(loadDir(FIXTURES_DIR), loadDir(resolve(recordedDir)));
console.log(JSON.stringify(report, null, 2));
console.error(
  `[drift] changed=${report.changed.length} promptChanged=${report.promptChanged.length} incompleteRecordings=${report.incompleteRecordings.length} unmatchedCommitted=${report.unmatchedCommitted.length} unmatchedRecorded=${report.unmatchedRecorded.length}`
);
