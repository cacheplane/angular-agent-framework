import { mkdir, readFile, symlink } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

/** Preserve application resolution in relocated fixtures with nested or hoisted installs. */
export async function linkFixtureDependencies(appRoot: string, fixtureRoot: string): Promise<void> {
  const manifest = JSON.parse(await readFile(join(appRoot, 'package.json'), 'utf8'));
  const require = createRequire(join(appRoot, 'package.json'));
  for (const name of Object.keys({ ...manifest.dependencies, ...manifest.devDependencies })) {
    let source: string | undefined;
    for (const directory of require.resolve.paths(name) ?? []) {
      const candidate = join(directory, name);
      try {
        if (JSON.parse(await readFile(join(candidate, 'package.json'), 'utf8')).name === name) {
          source = candidate;
          break;
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
    if (!source) throw new Error(`Cannot resolve fixture dependency ${name}`);
    const target = join(fixtureRoot, 'node_modules', name);
    await mkdir(dirname(target), { recursive: true });
    await symlink(source, target, 'dir');
  }
}
