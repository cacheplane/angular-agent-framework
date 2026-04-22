import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outputRoot = path.join(workspaceRoot, 'dist/packages/mcp');
const projectJsonPath = path.join(workspaceRoot, 'packages/mcp/project.json');
const packageJsonPath = path.join(outputRoot, 'package.json');

test('source package manifest entrypoints exist locally', () => {
  const packageJson = require('./package.json');
  const binPath = packageJson.bin['@cacheplane/langgraph-mcp'];

  assert.equal(fs.existsSync(path.join(workspaceRoot, 'packages/mcp', packageJson.main)), true);
  assert.equal(fs.existsSync(path.join(workspaceRoot, 'packages/mcp', binPath)), true);
});

function loadBuiltPackageJson() {
  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
}

test('built package manifest entrypoints resolve inside Nx output', () => {
  const packageJson = loadBuiltPackageJson();
  const binPath = packageJson.bin['@cacheplane/langgraph-mcp'];

  assert.equal(fs.existsSync(path.join(outputRoot, packageJson.main)), true);
  assert.equal(fs.existsSync(path.join(outputRoot, binPath)), true);
  assert.equal(fs.existsSync(path.join(outputRoot, packageJson.types)), true);
});

test('built package can discover bundled api docs from package root', () => {
  const loaderPath = path.join(outputRoot, 'src/data/loader.js');
  const originalCwd = process.cwd();
  const tempCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-package-smoke-'));

  process.chdir(tempCwd);

  try {
    delete require.cache[require.resolve(loaderPath)];
    const { getAllSymbolNames } = require(loaderPath);

    assert.equal(fs.existsSync(path.join(outputRoot, 'api-docs.json')), true);
    assert.equal(fs.existsSync(path.join(tempCwd, 'api-docs.json')), false);
    assert.equal(fs.existsSync(path.join(tempCwd, 'apps/website/public/api-docs.json')), false);
    assert.equal(getAllSymbolNames().includes('agent'), true);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(tempCwd, { recursive: true, force: true });
  }
});

test('project declares a named MCP smoke target', () => {
  const projectJson = JSON.parse(fs.readFileSync(projectJsonPath, 'utf8'));

  assert.equal(projectJson.targets.test.executor, 'nx:run-commands');
  assert.deepEqual(projectJson.targets.test.dependsOn, ['build']);
  assert.equal(projectJson.targets.test.options.command, 'npm --prefix packages/mcp run smoke');
});
