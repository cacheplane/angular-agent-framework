#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCOPE_KEYS = [
  'library',
  'website',
  'cockpit',
  'cockpit_examples',
  'cockpit_smoke',
  'cockpit_secret',
  'cockpit_deploy_smoke',
  'examples_chat',
  'cockpit_e2e',
  'website_e2e',
  'posthog',
];

const PROJECT_SKIP_DIRS = new Set([
  '.git',
  '.next',
  '.nx',
  'coverage',
  'dist',
  'node_modules',
]);

export function emptyScope() {
  return Object.fromEntries(SCOPE_KEYS.map((key) => [key, false]));
}

export function fullScope() {
  return Object.fromEntries(SCOPE_KEYS.map((key) => [key, true]));
}

export function classifyChangedFiles(changedFiles, workspace) {
  const scope = emptyScope();
  const projects = workspace.projects ?? [];
  const publishableProjects = new Set(workspace.publishableProjects ?? []);

  for (const changedFile of changedFiles.map(normalizePath).filter(Boolean)) {
    if (isGlobalCiFile(changedFile)) {
      return fullScope();
    }

    const owningProjects = projects.filter((project) => ownsPath(project, changedFile));

    for (const project of owningProjects) {
      applyProjectScope(scope, project, publishableProjects);
    }

    applyFallbackPathScope(scope, changedFile);
  }

  return scope;
}

export function loadWorkspaceMetadata(workspaceRoot) {
  return {
    projects: discoverProjects(workspaceRoot),
    publishableProjects: loadPublishableProjects(workspaceRoot),
  };
}

export function discoverProjects(workspaceRoot) {
  const projects = [];

  walk(workspaceRoot, (absolutePath) => {
    const projectJson = path.join(absolutePath, 'project.json');
    if (!existsSync(projectJson)) {
      return;
    }

    const project = JSON.parse(readFileSync(projectJson, 'utf8'));
    const root = normalizePath(path.relative(workspaceRoot, absolutePath));
    projects.push({
      ...project,
      root,
      sourceRoot: normalizePath(project.sourceRoot ?? root),
      tags: Array.isArray(project.tags) ? project.tags : [],
      targets: project.targets ?? {},
    });
  });

  return projects.sort((a, b) => b.root.length - a.root.length);
}

function walk(directory, visit) {
  visit(directory);

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || PROJECT_SKIP_DIRS.has(entry.name)) {
      continue;
    }

    walk(path.join(directory, entry.name), visit);
  }
}

function loadPublishableProjects(workspaceRoot) {
  const nxJsonPath = path.join(workspaceRoot, 'nx.json');
  if (!existsSync(nxJsonPath)) {
    return [];
  }

  const nxJson = JSON.parse(readFileSync(nxJsonPath, 'utf8'));
  return nxJson.release?.groups?.publishable?.projects ?? [];
}

function applyProjectScope(scope, project, publishableProjects) {
  const tags = new Set(project.tags ?? []);
  const targets = project.targets ?? {};
  const root = project.root ?? '';
  const name = project.name ?? '';

  if (publishableProjects.has(name)) {
    scope.library = true;
    scope.website = true;
    scope.website_e2e = true;
    scope.cockpit = true;
    scope.cockpit_examples = true;
    scope.cockpit_smoke = true;
    scope.cockpit_secret = true;
    scope.cockpit_deploy_smoke = true;
    scope.examples_chat = true;
    scope.cockpit_e2e = true;
  }

  if (tags.has('scope:website') || name === 'website' || root === 'apps/website') {
    scope.website = true;
    scope.website_e2e = true;
  }

  if (tags.has('scope:cockpit') || name === 'cockpit' || root === 'apps/cockpit') {
    scope.cockpit = true;
    scope.cockpit_examples = true;
    scope.cockpit_deploy_smoke = true;
    scope.cockpit_e2e = true;
  }

  if (tags.has('scope:examples') || root === 'examples/chat' || root.startsWith('examples/chat/')) {
    scope.examples_chat = true;
  }

  if (tags.has('scope:gtm') || name === 'posthog-tools' || root === 'tools/posthog') {
    scope.posthog = true;
  }

  if (root.startsWith('cockpit/')) {
    if (root.includes('/angular') || project.projectType === 'application') {
      scope.cockpit_examples = true;
    }

    if (targets.smoke && root.includes('/python')) {
      scope.cockpit_smoke = true;
    }

    if (targets.integration) {
      scope.cockpit_secret = true;
    }

    if (targets.e2e) {
      scope.cockpit_e2e = true;
    }
  }

  if (
    root.startsWith('libs/cockpit-') ||
    root === 'libs/design-tokens' ||
    root === 'libs/ui-react' ||
    root === 'libs/example-layouts' ||
    root === 'libs/e2e-harness'
  ) {
    scope.cockpit = true;
    scope.cockpit_examples = true;
    scope.cockpit_deploy_smoke = true;
    scope.cockpit_e2e = true;
  }

  if (root === 'libs/e2e-harness' || root === 'libs/cockpit-testing') {
    scope.cockpit_e2e = true;
  }
}

function applyFallbackPathScope(scope, changedFile) {
  if (changedFile === 'vercel.json') {
    scope.website = true;
    scope.website_e2e = true;
  }

  if (changedFile === 'vercel.cockpit.json') {
    scope.cockpit = true;
    scope.cockpit_deploy_smoke = true;
  }

  if (changedFile === 'vercel.examples.json' || changedFile === 'scripts/assemble-examples.ts') {
    scope.cockpit_examples = true;
  }

  if (changedFile === 'apps/cockpit/scripts/deploy-smoke.ts' || changedFile === 'scripts/deploy-smoke.ts') {
    scope.cockpit_deploy_smoke = true;
  }

  if (
    changedFile === 'vercel.demo.json' ||
    changedFile === 'scripts/assemble-demo.ts' ||
    changedFile === 'scripts/demo-middleware.ts' ||
    changedFile === 'scripts/langgraph-proxy.ts' ||
    changedFile === 'scripts/rate-limit.ts'
  ) {
    scope.examples_chat = true;
  }

  if (changedFile.startsWith('tools/posthog/')) {
    scope.posthog = true;
  }
}

function isGlobalCiFile(changedFile) {
  return (
    changedFile === '.github/workflows/ci.yml' ||
    changedFile === 'package.json' ||
    changedFile === 'package-lock.json' ||
    changedFile === 'nx.json' ||
    changedFile === 'tsconfig.json' ||
    changedFile === 'tsconfig.base.json' ||
    changedFile === 'eslint.config.mjs'
  );
}

function ownsPath(project, changedFile) {
  const root = normalizePath(project.root);
  const sourceRoot = normalizePath(project.sourceRoot);

  return (
    changedFile === `${root}/project.json` ||
    changedFile === root ||
    changedFile.startsWith(`${root}/`) ||
    changedFile === sourceRoot ||
    changedFile.startsWith(`${sourceRoot}/`)
  );
}

function normalizePath(value) {
  return String(value ?? '').replaceAll(path.sep, '/').replace(/^\.\//, '').replace(/\/+$/, '');
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) {
      continue;
    }

    args[arg.slice(2)] = argv[index + 1];
    index += 1;
  }
  return args;
}

function changedFilesBetween(baseSha, headSha, workspaceRoot) {
  return execFileSync('git', ['diff', '--name-only', baseSha, headSha], {
    cwd: workspaceRoot,
    encoding: 'utf8',
  })
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function writeOutputs(scope, outputPath) {
  const lines = SCOPE_KEYS.map((key) => `${key}=${scope[key] ? 'true' : 'false'}`);

  if (outputPath) {
    appendFileSync(outputPath, `${lines.join('\n')}\n`);
  }

  for (const line of lines) {
    console.log(line);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const workspaceRoot = process.cwd();

  if (args.event === 'push') {
    writeOutputs(fullScope(), args.output);
    console.log('Push to main runs the full CI suite.');
    return;
  }

  const base = args.base;
  const head = args.head;
  if (!base || !head) {
    throw new Error('Expected --base and --head for pull request scope detection.');
  }

  const changedFiles = changedFilesBetween(base, head, workspaceRoot);
  const workspace = loadWorkspaceMetadata(workspaceRoot);
  const scope = classifyChangedFiles(changedFiles, workspace);

  console.log('Changed files:');
  for (const changedFile of changedFiles) {
    console.log(`  ${changedFile}`);
  }

  writeOutputs(scope, args.output);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`::error::${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
