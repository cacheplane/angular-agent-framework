import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// Guard for a latent module-resolution defect.
//
// `tsconfig.base.json` declares the workspace `paths` map with entries that are
// relative to the workspace root (`libs/design-tokens/src/index.ts`). A project
// tsconfig that extends the base and re-declares `"baseUrl": "."` overrides the
// inherited base directory, because `baseUrl` outranks the implicit
// `pathsBasePath`. Every inherited substitution is then probed under the
// *library* folder (`libs/<lib>/libs/design-tokens/src/index.ts`), misses, and
// only resolves because the npm workspace symlink in `node_modules` happens to
// land on the same source file. Builds stay green, so nothing catches it.
//
// A project that declares its own `paths` (including an empty `{}`) is exempt:
// there `baseUrl` does real directory-resolution work and shadows nothing.

const workspaceRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const baseConfigPath = join(workspaceRoot, 'tsconfig.base.json');

function readConfig(configPath) {
  const parsed = ts.parseConfigFileTextToJson(configPath, readFileSync(configPath, 'utf8'));
  expect(parsed.error, `failed to parse ${relative(workspaceRoot, configPath)}`).toBeUndefined();
  return parsed.config ?? {};
}

/**
 * Walk the `extends` chain from `configPath` upwards, stopping at (and
 * excluding) `tsconfig.base.json`. Returns null when the chain never reaches
 * the base config — such a project does not inherit the workspace `paths`.
 */
function chainBelowBase(configPath) {
  const chain = [];
  let current = configPath;
  for (let hop = 0; hop < 10; hop += 1) {
    if (current === baseConfigPath) return chain;
    const config = readConfig(current);
    chain.push({ path: current, config });
    if (typeof config.extends !== 'string') return null;
    const next = resolve(dirname(current), config.extends);
    current = existsSync(next) ? next : `${next}.json`;
    if (!existsSync(current)) return null;
  }
  return null;
}

function libraryTsconfigs() {
  const found = [];
  for (const entry of readdirSync(join(workspaceRoot, 'libs'), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const libDir = join(workspaceRoot, 'libs', entry.name);
    for (const file of readdirSync(libDir)) {
      if (file.startsWith('tsconfig') && file.endsWith('.json')) found.push(join(libDir, file));
    }
  }
  return found.sort();
}

describe('library tsconfig path inheritance', () => {
  it('never shadows the workspace baseUrl the inherited paths map resolves against', () => {
    const offenders = [];
    for (const configPath of libraryTsconfigs()) {
      const chain = chainBelowBase(configPath);
      if (chain === null) continue;
      const declaresOwnPaths = chain.some((link) => link.config.compilerOptions?.paths !== undefined);
      if (declaresOwnPaths) continue;
      const shadowing = chain.find((link) => link.config.compilerOptions?.baseUrl !== undefined);
      if (shadowing) offenders.push(relative(workspaceRoot, shadowing.path));
    }
    expect([...new Set(offenders)]).toEqual([]);
  });

  it.each([
    'libs/cockpit-runtime-bridge',
    'libs/growth',
    'libs/example-layouts',
    'libs/cockpit-registry',
  ])('resolves @threadplane/design-tokens through the paths map from %s', (libDir) => {
    const configPath = join(workspaceRoot, libDir, 'tsconfig.json');
    const parsed = ts.getParsedCommandLineOfConfigFile(configPath, {}, {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
      },
      getCurrentDirectory: () => workspaceRoot,
      useCaseSensitiveFileNames: true,
    });
    expect(parsed, `could not parse ${libDir}/tsconfig.json`).toBeDefined();

    const containingFile = join(workspaceRoot, libDir, 'src', 'index.ts');
    const resolved = ts.resolveModuleName(
      '@threadplane/design-tokens',
      containingFile,
      parsed.options,
      ts.sys,
    ).resolvedModule;

    expect(resolved?.resolvedFileName).toBe(join(workspaceRoot, 'libs/design-tokens/src/index.ts'));
    // A `packageId` means TypeScript fell through the `paths` substitution and
    // found the source only via the npm workspace symlink under node_modules.
    expect(resolved?.packageId, 'resolved via node_modules symlink, not the paths map').toBeUndefined();
  });
});
