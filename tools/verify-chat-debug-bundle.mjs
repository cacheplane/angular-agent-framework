#!/usr/bin/env node
// SPDX-License-Identifier: MIT
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const [root, expected] = process.argv.slice(2);

if (!root || !['present', 'absent'].includes(expected)) {
  console.error('Usage: node tools/verify-chat-debug-bundle.mjs <dist-dir> <present|absent>');
  process.exit(2);
}

const sentinels = [
  'Checkpoint timeline',
  'Chat Debug',
  'chat-debug-state-inspector',
  'chat-debug-timeline-inspector',
  'ngaf-chat-debug-root-styles',
];

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

const hits = [];
for (const file of files(root).filter((path) => /\.(m?js|css|html|map)$/.test(path))) {
  const contents = readFileSync(file, 'utf8');
  for (const sentinel of sentinels) {
    if (contents.includes(sentinel)) hits.push(`${file}: ${sentinel}`);
  }
}

if (expected === 'absent' && hits.length > 0) {
  console.error(`Expected chat-debug implementation to be absent, found:\n${hits.join('\n')}`);
  process.exit(1);
}

if (expected === 'present' && hits.length === 0) {
  console.error('Expected chat-debug implementation to be present, found no sentinels.');
  process.exit(1);
}

console.log(`chat-debug bundle check passed: ${expected}`);
