#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const entrypoint = path.join(__dirname, 'index.ts');
const result = spawnSync(
  process.execPath,
  ['--import', 'tsx', entrypoint, ...process.argv.slice(2)],
  { stdio: 'inherit' }
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
