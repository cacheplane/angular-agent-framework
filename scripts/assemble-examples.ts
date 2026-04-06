#!/usr/bin/env npx tsx
/**
 * Build all 14 Angular example apps and assemble them into a deploy directory.
 *
 * Output: deploy/examples/{product}/{topic}/ with index.html, main.js, styles.css
 *
 * Usage:
 *   npx tsx scripts/assemble-examples.ts
 *   npx tsx scripts/assemble-examples.ts --skip-build
 */
import { execSync } from 'child_process';
import { cpSync, mkdirSync, rmSync, existsSync } from 'fs';
import { resolve } from 'path';

const root = resolve(__dirname, '..');
const deployDir = resolve(root, 'deploy/examples');
const skipBuild = process.argv.includes('--skip-build');

const capabilities = [
  { product: 'langgraph', topic: 'streaming' },
  { product: 'langgraph', topic: 'persistence' },
  { product: 'langgraph', topic: 'interrupts' },
  { product: 'langgraph', topic: 'memory' },
  { product: 'langgraph', topic: 'durable-execution' },
  { product: 'langgraph', topic: 'subgraphs' },
  { product: 'langgraph', topic: 'time-travel' },
  { product: 'langgraph', topic: 'deployment-runtime' },
  { product: 'deep-agents', topic: 'planning' },
  { product: 'deep-agents', topic: 'filesystem' },
  { product: 'deep-agents', topic: 'subagents' },
  { product: 'deep-agents', topic: 'memory' },
  { product: 'deep-agents', topic: 'skills' },
  { product: 'deep-agents', topic: 'sandboxes' },
];

if (!skipBuild) {
  console.log('Building all 14 Angular apps...');
  execSync("npx nx run-many -t build --projects='cockpit-*-angular' --skip-nx-cache", {
    cwd: root,
    stdio: 'inherit',
  });
}

if (existsSync(deployDir)) rmSync(deployDir, { recursive: true });

for (const cap of capabilities) {
  const src = resolve(root, `dist/cockpit/${cap.product}/${cap.topic}/angular`);
  const dest = resolve(deployDir, `${cap.product}/${cap.topic}`);

  if (!existsSync(src)) {
    console.error(`❌ Missing build output: ${src}`);
    process.exit(1);
  }

  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
  console.log(`✅ ${cap.product}/${cap.topic}`);
}

console.log(`\nAssembled ${capabilities.length} apps to ${deployDir}`);
