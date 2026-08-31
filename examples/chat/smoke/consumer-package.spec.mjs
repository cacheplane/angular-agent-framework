// SPDX-License-Identifier: MIT

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, symlink } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ANGULAR_LANES, getAngularLane } from './angular-versions.mjs';
import { applyAngularLane, strictNpmEnv } from './consumer-package.mjs';
import { parseArgs } from './cli.mjs';

function runNode(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stderr }));
  });
}

test('applies every selected Angular lane without replacing unrelated dependencies', () => {
  for (const major of [20, 21, 22]) {
    const packageJson = {
      dependencies: {
        ...Object.fromEntries(
          Object.keys(ANGULAR_LANES[major].dependencies).map((name) => [
            name,
            'old',
          ])
        ),
        keep: '1.0.0',
      },
      devDependencies: Object.fromEntries(
        Object.keys(ANGULAR_LANES[major].devDependencies).map((name) => [
          name,
          'old',
        ])
      ),
    };

    const result = applyAngularLane(packageJson, ANGULAR_LANES[major]);

    assert.notStrictEqual(result, packageJson);
    assert.notStrictEqual(result.dependencies, packageJson.dependencies);
    assert.notStrictEqual(result.devDependencies, packageJson.devDependencies);
    assert.equal(result.dependencies.keep, '1.0.0');
    for (const [name, version] of Object.entries(
      ANGULAR_LANES[major].dependencies
    )) {
      assert.equal(result.dependencies[name], version, `${major}: ${name}`);
      assert.equal(packageJson.dependencies[name], 'old', `${major}: ${name}`);
    }
    for (const [name, version] of Object.entries(
      ANGULAR_LANES[major].devDependencies
    )) {
      assert.equal(result.devDependencies[name], version, `${major}: ${name}`);
      assert.equal(
        packageJson.devDependencies[name],
        'old',
        `${major}: ${name}`
      );
    }
  }
});

test('forces strict peer resolution while preserving the base environment', () => {
  assert.deepEqual(
    strictNpmEnv({ EXISTING: 'yes', npm_config_legacy_peer_deps: 'true' }),
    {
      EXISTING: 'yes',
      npm_config_legacy_peer_deps: 'false',
      NPM_CONFIG_LEGACY_PEER_DEPS: 'false',
    }
  );
});

test('parses supported and unsupported Angular majors', () => {
  assert.equal(parseArgs([]).angularMajor, '21');
  assert.equal(parseArgs(['--angular-major', '22']).angularMajor, '22');
  assert.throws(
    () => parseArgs(['--angular-major']),
    /--angular-major requires a value/
  );

  const options = parseArgs(['--angular-major', '23']);
  assert.throws(
    () => getAngularLane(options.angularMajor),
    /Unsupported Angular major 23/
  );
});

test('executes the CLI when it is invoked through a symlink', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'threadplane-smoke-cli-'));
  const linkedCli = join(directory, 'smoke-cli.mjs');

  try {
    try {
      await symlink(new URL('./cli.mjs', import.meta.url), linkedCli, 'file');
    } catch (error) {
      if (['EACCES', 'EINVAL', 'ENOSYS', 'EPERM'].includes(error.code)) {
        t.skip(`Symlink creation is unsupported: ${error.code}`);
        return;
      }
      throw error;
    }

    const result = await runNode([linkedCli, '--angular-major', '23']);

    assert.equal(result.code, 1);
    assert.match(result.stderr, /Unsupported Angular major 23/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('builds the template with the production configuration', async () => {
  const packageJson = JSON.parse(
    await readFile(new URL('./template/package.json', import.meta.url), 'utf8')
  );

  assert.equal(
    packageJson.scripts.build,
    'ng build --configuration production'
  );
});

test('includes required browser bundle closures in the template', async () => {
  const packageJson = JSON.parse(
    await readFile(new URL('./template/package.json', import.meta.url), 'utf8')
  );

  assert.equal(packageJson.dependencies['posthog-js'], '^1.372.0');
  assert.equal(packageJson.dependencies.katex, '^0.17.0');
});
