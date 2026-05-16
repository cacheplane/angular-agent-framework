// SPDX-License-Identifier: MIT
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const FIXTURES_DIR = resolve(__dirname, '../fixtures');

if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY required for drift detection');
  process.exit(1);
}

const fixtureFiles = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.json'));
if (fixtureFiles.length === 0) {
  console.log('No fixtures to check.');
  process.exit(0);
}

const tmpDir = mkdtempSync(join(tmpdir(), 'aimock-drift-'));
const drifts: Array<{ name: string; bytesCommitted: number; bytesRecorded: number; diff: number }> = [];

for (const file of fixtureFiles) {
  const name = file.replace(/\.json$/, '');
  const committedPath = join(FIXTURES_DIR, file);
  const recordedPath = join(tmpDir, file);

  const result = spawnSync(
    'npx',
    [
      '-p', '@copilotkit/aimock',
      'llmock',
      '--record',
      '--provider-openai', 'https://api.openai.com',
      '--out', recordedPath,
    ],
    { stdio: 'inherit', env: process.env },
  );

  if (result.status !== 0) {
    console.error(`Drift check failed to record ${name}`);
    process.exit(result.status ?? 1);
  }

  const committed = readFileSync(committedPath);
  const recorded = readFileSync(recordedPath);
  const diff = Math.abs(committed.length - recorded.length);

  drifts.push({ name, bytesCommitted: committed.length, bytesRecorded: recorded.length, diff });
}

console.log(JSON.stringify({ drifts }, null, 2));

const THRESHOLD_PCT = 0.2;
const significant = drifts.filter((d) => d.diff / Math.max(d.bytesCommitted, 1) > THRESHOLD_PCT);
if (significant.length > 0) {
  console.error(`::error::Drift exceeds threshold for: ${significant.map((d) => d.name).join(', ')}`);
  process.exit(2);
}
