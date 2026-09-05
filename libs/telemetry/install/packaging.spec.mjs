import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const json = async (path) => JSON.parse(await readFile(resolve(path), 'utf8'));
describe('install collector package assembly', () => {
  it.each(['chat', 'langgraph', 'ag-ui', 'render'])(
    'explicitly ships the shared hook in %s and includes it in build inputs',
    async (name) => {
      const pkg = await json(`libs/${name}/package.json`),
        config = await json(`libs/${name}/ng-package.json`),
        project = await json(`libs/${name}/project.json`);
      expect(pkg.scripts?.postinstall).toBe('node install/postinstall.cjs');
      expect(pkg.exports?.['./development-install']).toEqual({
        types: './.install-collector/development-install.d.ts',
        default: './.install-collector/development-install.mjs',
      });
      expect(pkg.imports?.['#development-install']).toEqual({
        types: './.install-collector/development-install.d.ts',
        default: `@threadplane/${name}/development-install`,
      });
      expect(config.assets).toContainEqual({
        input: '.install-collector',
        glob: 'development-install.*',
        output: '.install-collector',
      });
      expect(config.keepLifecycleScripts).toBe(true);
      expect(project.targets.build.executor).toBe('@nx/angular:package');
      expect(project.targets['prepare-install'].options.command).toBe(
        `node libs/telemetry/install/assemble-package.mjs ${name}`
      );
      expect(project.targets.build.dependsOn).toEqual([
        '^build',
        'prepare-install',
      ]);
      expect(config.assets).toContainEqual({
        input: '.install-collector',
        glob: '*.cjs',
        output: 'install',
      });
      expect(project.targets.build.inputs).toContain(
        '{workspaceRoot}/libs/telemetry/install/*'
      );
      expect(project.implicitDependencies).toContain('telemetry');
      const prepared = await readFile(
        resolve(`libs/${name}/src/lib/package-version.ts`),
        'utf8'
      ).catch(() => '');
      expect(prepared).toContain(
        `export const THREADPLANE_PACKAGE_VERSION = ${JSON.stringify(
          pkg.version
        )};`
      );
      expect(project.targets['prepare-install'].outputs).toContain(
        '{projectRoot}/src/lib/package-version.ts'
      );
    }
  );
  it('keeps root and the explicit telemetry helper package installation inert', async () => {
    expect((await json('package.json')).scripts.postinstall).toBeUndefined();
    expect((await json('libs/telemetry/package.json')).scripts).toBeUndefined();
  });
});
