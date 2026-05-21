#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCOPE_KEYS = [
  'library', 'website', 'website_e2e',
  'cockpit', 'cockpit_examples', 'cockpit_smoke',
  'cockpit_secret', 'cockpit_deploy_smoke', 'cockpit_e2e',
  'examples_chat', 'posthog',
];

const GLOBAL_CI_FILES = new Set([
  '.github/workflows/ci.yml',
  'package.json',
  'package-lock.json',
  'nx.json',
  'tsconfig.json',
  'tsconfig.base.json',
  'eslint.config.mjs',
]);

export function emptyScope() {
  return Object.fromEntries(SCOPE_KEYS.map((k) => [k, false]));
}

export function fullScope() {
  return Object.fromEntries(SCOPE_KEYS.map((k) => [k, true]));
}

function normalizePath(value) {
  return String(value ?? '').replaceAll(path.sep, '/').replace(/^\.\//, '').replace(/\/+$/, '');
}

function tagToScopeKey(tag) {
  // 'scope:cockpit-e2e' → 'cockpit_e2e'
  return tag.replace(/^scope:/, '').replaceAll('-', '_');
}

/**
 * Pure-function classifier.
 *
 * @param {string[]} changedFiles - normalized repo-relative paths
 * @param {Array<{name: string, tags: string[]}>} affectedProjects
 *        — projects nx considers affected, with their tags
 * @returns {Record<string, boolean>} scope booleans keyed by SCOPE_KEYS
 */
export function classifyFromAffected(changedFiles, affectedProjects) {
  for (const f of changedFiles) {
    if (GLOBAL_CI_FILES.has(f)) return fullScope();
  }
  const scope = emptyScope();
  for (const project of affectedProjects) {
    for (const tag of project.tags ?? []) {
      if (!tag.startsWith('scope:')) continue;
      const key = tagToScopeKey(tag);
      if (SCOPE_KEYS.includes(key)) scope[key] = true;
    }
  }
  return scope;
}

function changedFilesBetween(base, head, workspaceRoot) {
  return execFileSync('git', ['diff', '--name-only', base, head], {
    cwd: workspaceRoot,
    encoding: 'utf8',
  })
    .split('\n')
    .map((line) => normalizePath(line.trim()))
    .filter(Boolean);
}

function loadAffectedProjects(base, head, workspaceRoot) {
  const namesJson = execFileSync('npx', [
    'nx', 'show', 'projects',
    '--affected',
    '--base', base, '--head', head,
    '--json',
  ], { cwd: workspaceRoot, encoding: 'utf8' });
  const names = JSON.parse(namesJson);
  return names.map((name) => {
    const projectJson = execFileSync('npx', [
      'nx', 'show', 'project', name, '--json',
    ], { cwd: workspaceRoot, encoding: 'utf8' });
    const project = JSON.parse(projectJson);
    return { name: project.name ?? name, tags: project.tags ?? [] };
  });
}

function writeOutputs(scope, outputPath) {
  const lines = SCOPE_KEYS.map((k) => `${k}=${scope[k] ? 'true' : 'false'}`);
  if (outputPath) appendFileSync(outputPath, `${lines.join('\n')}\n`);
  for (const line of lines) console.log(line);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    args[a.slice(2)] = argv[i + 1];
    i++;
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const workspaceRoot = process.cwd();

  if (args.event === 'push') {
    writeOutputs(fullScope(), args.output);
    console.log('Push to main runs the full CI suite.');
    return;
  }

  if (!args.base || !args.head) {
    throw new Error('Expected --base and --head for pull request scope detection.');
  }

  const changedFiles = changedFilesBetween(args.base, args.head, workspaceRoot);
  const affectedProjects = loadAffectedProjects(args.base, args.head, workspaceRoot);
  const scope = classifyFromAffected(changedFiles, affectedProjects);

  console.log('Changed files:');
  for (const f of changedFiles) console.log(`  ${f}`);
  console.log(`Affected projects (${affectedProjects.length}):`);
  for (const p of affectedProjects) console.log(`  ${p.name} [${p.tags.join(', ')}]`);

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
