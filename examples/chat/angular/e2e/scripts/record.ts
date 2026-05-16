// SPDX-License-Identifier: MIT
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const NAME = process.argv[2];
if (!NAME) {
  console.error('Usage: record.ts <fixture-name>');
  process.exit(1);
}
if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY required for record mode');
  process.exit(1);
}

const FIXTURE_PATH = resolve(__dirname, `../fixtures/${NAME}.json`);

const result = spawnSync(
  'npx',
  [
    '-p', '@copilotkit/aimock',
    'llmock',
    '--record',
    '--provider-openai', 'https://api.openai.com',
    '--out', FIXTURE_PATH,
  ],
  { stdio: 'inherit', env: process.env },
);

if (result.status !== 0) {
  console.error('Record failed');
  process.exit(result.status ?? 1);
}

console.log(`Recorded fixture to ${FIXTURE_PATH}`);
