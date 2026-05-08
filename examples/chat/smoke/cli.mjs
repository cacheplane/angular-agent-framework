#!/usr/bin/env node
// SPDX-License-Identifier: MIT
/* eslint-disable no-console */

/**
 * Interactive smoke generator. Scaffolds a fresh, npm-installed
 * consumer of the canonical examples/chat demo so we can validate the
 * published @ngaf/* packages against the same UI the workspace dev
 * sees. Default target: ~/tmp/ngaf (overridable).
 */

import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output, exit } from 'node:process';
import {
  cp, rm, writeFile, readFile,
} from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { spawn, execSync } from 'node:child_process';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = join(SCRIPT_DIR, 'template');
const DEMO_APP_DIR = resolve(SCRIPT_DIR, '..', 'angular', 'src', 'app');
const CHECKLIST = join(SCRIPT_DIR, 'CHECKLIST.md');
const DEFAULT_TARGET = join(homedir(), 'tmp', 'ngaf');

const NGAF_PACKAGES = ['@ngaf/ag-ui', '@ngaf/chat', '@ngaf/langgraph', '@ngaf/render'];

async function main() {
  const rl = createInterface({ input, output });
  const ask = (q, def) => rl.question(def !== undefined ? `${q} (${def}) ` : `${q} `).then(v => v.trim() || def);

  console.log('\n📦 NGAF chat smoke generator\n');

  const target = resolve(await ask('Target directory:', DEFAULT_TARGET));
  let action = 'fresh';
  if (existsSync(target)) {
    const choice = await ask(
      `Directory exists. [r]efresh / [u]pdate in place / [c]ancel:`,
      'c',
    );
    const c = choice.toLowerCase();
    if (c.startsWith('c')) { console.log('Cancelled.'); rl.close(); exit(0); }
    if (c.startsWith('u')) { action = 'update'; }
    else if (c.startsWith('r')) { action = 'fresh'; }
    else { console.log('Unrecognised choice; cancelling.'); rl.close(); exit(1); }
  }

  let resolvedVersion;
  try {
    resolvedVersion = execSync('npm view @ngaf/chat version', { encoding: 'utf8' }).trim();
  } catch (e) {
    console.error('Could not resolve @ngaf/chat version from npm:', e.message);
    rl.close();
    exit(1);
  }
  const versionAnswer = await ask(`@ngaf version:`, resolvedVersion);
  const version = versionAnswer.replace(/^[v^~]+/, '');

  const installAnswer = await ask('Run `npm install` now? [Y/n]:', 'Y');
  const doInstall = !installAnswer.toLowerCase().startsWith('n');
  let doStart = false;
  if (doInstall) {
    const startAnswer = await ask('Run `npm start` after install? [Y/n]:', 'Y');
    doStart = !startAnswer.toLowerCase().startsWith('n');
  }

  rl.close();

  if (action === 'fresh') {
    console.log(`\n→ Removing ${target} ...`);
    await rm(target, { recursive: true, force: true });
    console.log(`→ Copying scaffold from ${TEMPLATE_DIR} ...`);
    await cp(TEMPLATE_DIR, target, { recursive: true });
    console.log(`→ Copying app code from ${DEMO_APP_DIR} ...`);
    await cp(DEMO_APP_DIR, join(target, 'src', 'app'), { recursive: true });
  } else {
    console.log(`\n→ Updating in place at ${target} (skipping scaffold copy) ...`);
  }

  // Pin version in package.json
  const pkgPath = join(target, 'package.json');
  const pkgRaw = await readFile(pkgPath, 'utf8');
  const pkg = JSON.parse(pkgRaw);
  for (const name of NGAF_PACKAGES) {
    if (pkg.dependencies && pkg.dependencies[name]) {
      pkg.dependencies[name] = `^${version}`;
    }
  }
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`→ Pinned ${NGAF_PACKAGES.join(', ')} to ^${version}`);

  // Copy CHECKLIST.md
  await cp(CHECKLIST, join(target, 'CHECKLIST.md'));

  // Write SMOKE_RUN.md capture
  const smokeRun = await buildSmokeRun({ target, version });
  await writeFile(join(target, 'SMOKE_RUN.md'), smokeRun);
  console.log('→ Wrote SMOKE_RUN.md');

  if (doInstall) {
    console.log('\n→ Running npm install ...');
    await runChild('npm', ['install'], { cwd: target });
  }

  console.log(`\n✓ Smoke consumer ready at ${target}`);
  console.log(`  Backend:  cd examples/chat/python && uv run langgraph dev --port 2024`);
  console.log(`  App:      cd ${target} && npm start`);
  console.log(`  URL:      http://localhost:4200`);
  console.log(`  Checklist: cat ${join(target, 'CHECKLIST.md')}\n`);

  if (doStart) {
    console.log('→ Starting `npm start` (Ctrl+C to stop) ...\n');
    await runChild('npm', ['start'], { cwd: target, foreground: true });
  }
}

async function buildSmokeRun({ target, version }) {
  const lines = [
    '# Smoke run capture',
    '',
    `- Timestamp: ${new Date().toISOString()}`,
    `- Target: ${target}`,
    `- @ngaf version (pinned): ^${version}`,
    `- Node: ${process.version}`,
    `- Platform: ${process.platform} ${process.arch}`,
  ];
  try {
    const sha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    lines.push(`- Workspace git SHA: ${sha}`);
  } catch { /* outside a repo, ignore */ }
  try {
    const npmV = execSync('npm --version', { encoding: 'utf8' }).trim();
    lines.push(`- npm: ${npmV}`);
  } catch { /* ignore */ }
  lines.push('', '## Resolved npm versions', '');
  for (const name of NGAF_PACKAGES) {
    try {
      const v = execSync(`npm view ${name}@^${version} version`, { encoding: 'utf8' }).trim();
      lines.push(`- ${name}@${v}`);
    } catch {
      lines.push(`- ${name}: (resolution failed)`);
    }
  }
  return lines.join('\n') + '\n';
}

function runChild(cmd, args, opts = {}) {
  return new Promise((resolveP, rejectP) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('exit', (code) => code === 0 ? resolveP() : rejectP(new Error(`${cmd} exited ${code}`)));
    child.on('error', rejectP);
  });
}

main().catch(err => {
  console.error('\n✖ Smoke generator failed:', err.message);
  exit(1);
});
