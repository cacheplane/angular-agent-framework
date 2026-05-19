#!/usr/bin/env -S npx tsx
// SPDX-License-Identifier: MIT
//
// Throwaway aimock scaffold generator.
// Usage: npx tsx scripts/generate-aimock-scaffold.ts --cap <id>
//
// For a cap in apps/cockpit/scripts/capability-registry.ts with a pythonDir,
// creates the per-cap aimock e2e directory under
// cockpit/<product>/<topic>/angular/e2e/ (5 files), adds the e2e Nx target
// to cockpit/<product>/<topic>/angular/project.json, and appends a matrix
// entry to the cockpit-e2e job in .github/workflows/ci.yml.
//
// All-or-nothing: validates every precondition before writing anything.
// Refuses on any pre-existing target. Delete after the Task #4 batch lands.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { capabilities, type Capability } from '../apps/cockpit/scripts/capability-registry';

const REPO_ROOT = resolve(__dirname, '..');

function die(msg: string): never {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

function parseArgs(): { capId: string } {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--cap');
  if (idx === -1 || idx === args.length - 1) {
    die('--cap <id> is required. Example: npx tsx scripts/generate-aimock-scaffold.ts --cap c-messages');
  }
  const capId = args[idx + 1]!;
  if (!capId) die('--cap value cannot be empty');
  return { capId };
}

function findCap(capId: string): Capability {
  const cap = capabilities.find((c) => c.id === capId);
  if (!cap) die(`cap "${capId}" not found in apps/cockpit/scripts/capability-registry.ts`);
  if (!cap.pythonDir) die(`cap "${capId}" has no pythonDir (in-process cap not eligible for aimock e2e)`);
  if (cap.pythonPort === undefined) die(`cap "${capId}" has no pythonPort`);
  return cap;
}

function playwrightConfig(port: number): string {
  return `// SPDX-License-Identifier: MIT
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:${port}',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  globalSetup: './global-setup-impl.ts',
  globalTeardown: require.resolve('../../../../../libs/e2e-harness/src/global-teardown'),
});
`;
}

function globalSetupImpl(cap: Capability): string {
  return `// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { createGlobalSetup } from '../../../../../libs/e2e-harness/src';

export default createGlobalSetup({
  langgraphCwd: '${cap.pythonDir}',
  langgraphPort: ${cap.pythonPort},
  angularProject: '${cap.angularProject}',
  angularPort: ${cap.port},
  fixturesDir: resolve(__dirname, 'fixtures'),
});
`;
}

const TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules", "test-results", "playwright-report"]
}
`;

function fixtureSkeleton(): string {
  return `{
  "fixtures": [
    {
      "match": { "userMessage": "TODO-prompt" },
      "response": { "content": "TODO-response" }
    }
  ]
}
`;
}

function specSkeleton(capId: string): string {
  return `// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { submitAndWaitForResponse } from '../../../../../libs/e2e-harness/src';

test('${capId}: TODO — describe behavior', async ({ page }) => {
  const bubble = await submitAndWaitForResponse(page, 'TODO-prompt');
  await expect(bubble).toContainText('TODO-substring');
});
`;
}

function e2eTargetEntry(cap: Capability): Record<string, unknown> {
  return {
    executor: '@nx/playwright:playwright',
    options: {
      config: `cockpit/${cap.product}/${cap.topic}/angular/e2e/playwright.config.ts`,
    },
  };
}

function validateAndPlan(cap: Capability): {
  e2eDir: string;
  files: Record<string, string>;
  projectJsonPath: string;
  projectJson: Record<string, any>;
  ciYmlPath: string;
  ciYmlBefore: string;
  ciYmlAfter: string;
} {
  const e2eDir = resolve(REPO_ROOT, `cockpit/${cap.product}/${cap.topic}/angular/e2e`);

  const files: Record<string, string> = {
    [`${e2eDir}/playwright.config.ts`]: playwrightConfig(cap.port),
    [`${e2eDir}/global-setup-impl.ts`]: globalSetupImpl(cap),
    [`${e2eDir}/tsconfig.json`]: TSCONFIG,
    [`${e2eDir}/fixtures/${cap.id}.json`]: fixtureSkeleton(),
    [`${e2eDir}/${cap.id}.spec.ts`]: specSkeleton(cap.id),
  };

  for (const path of Object.keys(files)) {
    if (existsSync(path)) die(`${path} already exists; refusing to overwrite`);
  }

  const projectJsonPath = resolve(REPO_ROOT, `cockpit/${cap.product}/${cap.topic}/angular/project.json`);
  if (!existsSync(projectJsonPath)) die(`${projectJsonPath} does not exist`);
  const projectJson = JSON.parse(readFileSync(projectJsonPath, 'utf8'));
  if (projectJson.targets?.e2e) {
    die(`project.json already has an e2e target for ${cap.angularProject}`);
  }

  const ciYmlPath = resolve(REPO_ROOT, '.github/workflows/ci.yml');
  if (!existsSync(ciYmlPath)) die(`${ciYmlPath} does not exist`);
  const ciYmlBefore = readFileSync(ciYmlPath, 'utf8');
  if (ciYmlBefore.includes(`{ angular: ${cap.angularProject},`)) {
    die(`ci.yml matrix already contains entry for ${cap.angularProject}`);
  }

  // Locate the last existing matrix entry and insert the new one after it.
  // Match indentation of existing lines: 10 spaces + "- { angular: ..."
  const matrixEntryRegex = /^(\s+- \{ angular: cockpit-[^}]+\})\s*$/gm;
  const matches = [...ciYmlBefore.matchAll(matrixEntryRegex)];
  if (matches.length === 0) {
    die('ci.yml does not contain a recognizable matrix.cap entry to insert after');
  }
  const lastMatch = matches[matches.length - 1]!;
  const insertAt = lastMatch.index! + lastMatch[0].length;

  // Use the existing entry's indentation. Find the leading spaces from lastMatch[1].
  const indent = lastMatch[1].match(/^(\s+)-/)?.[1] ?? '          ';

  // Pad the cap fields so columns line up roughly with existing entries.
  const angularField = `angular: ${cap.angularProject},`;
  const paddedAngular = angularField.padEnd(48);
  const newEntry = `\n${indent}- { ${paddedAngular} python: ${cap.pythonDir} }`;

  const ciYmlAfter = ciYmlBefore.slice(0, insertAt) + newEntry + ciYmlBefore.slice(insertAt);

  // No YAML reparse: the regex match locked us onto a known-shaped existing
  // matrix entry; inserting another line of identical shape preserves YAML
  // validity. CI is the authoritative validator. This is a throwaway tool —
  // delete after the Task #4 batch lands.

  return { e2eDir, files, projectJsonPath, projectJson, ciYmlPath, ciYmlBefore, ciYmlAfter };
}

function applyPlan(plan: ReturnType<typeof validateAndPlan>, cap: Capability): void {
  // Create directories.
  mkdirSync(plan.e2eDir, { recursive: true });
  mkdirSync(`${plan.e2eDir}/fixtures`, { recursive: true });

  // Write each file.
  for (const [path, content] of Object.entries(plan.files)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    console.log(`  + ${path.slice(REPO_ROOT.length + 1)}`);
  }

  // Update project.json.
  plan.projectJson.targets = { ...plan.projectJson.targets, e2e: e2eTargetEntry(cap) };
  writeFileSync(plan.projectJsonPath, JSON.stringify(plan.projectJson, null, 2) + '\n');
  console.log(`  ~ ${plan.projectJsonPath.slice(REPO_ROOT.length + 1)} (added e2e target)`);

  // Update ci.yml.
  writeFileSync(plan.ciYmlPath, plan.ciYmlAfter);
  console.log(`  ~ ${plan.ciYmlPath.slice(REPO_ROOT.length + 1)} (added matrix entry)`);
}

function main(): void {
  const { capId } = parseArgs();
  const cap = findCap(capId);
  console.log(`Scaffolding aimock e2e for ${cap.id} (${cap.angularProject})…`);
  const plan = validateAndPlan(cap);
  applyPlan(plan, cap);
  console.log(`Done. Next: hand-author cockpit/${cap.product}/${cap.topic}/angular/e2e/fixtures/${cap.id}.json and ${cap.id}.spec.ts.`);
}

main();
