import {
  capabilityModules,
  cockpitManifest,
} from '@threadplane/cockpit-registry';
import { capabilities } from './scripts/capability-registry';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The cockpit site is assembled from three lists that nothing forced to agree:
 *
 *  - `apps/cockpit/scripts/capability-registry.ts` — what serve/build/deploy know about;
 *  - `libs/cockpit-registry` `cockpitManifest` — what the Next route can resolve;
 *  - registry-owned `capabilityModules` — what supplies a page's assets.
 *
 * When the `runtimes` product shipped, only the first list learned about it, so
 * `/runtimes/core-capabilities/<topic>/overview/<lang>` threw
 * "No manifest entry found …" and every runtime page 500'd in production while
 * the whole suite stayed green. These assertions are the missing coupling.
 */
describe('cockpit capability wiring', () => {
  const resolveCockpitConfig = (fileName: string): string => {
    const workspaceConfigPath = resolve(
      process.cwd(),
      'apps/cockpit',
      fileName
    );
    return existsSync(workspaceConfigPath)
      ? workspaceConfigPath
      : resolve(process.cwd(), fileName);
  };

  const manifestKey = (e: {
    product: string;
    section: string;
    topic: string;
  }) => `${e.product}/${e.section}/${e.topic}`;

  it('gives every registered capability a resolvable manifest entry', () => {
    const manifestKeys = new Set(cockpitManifest.map(manifestKey));

    const unroutable = capabilities
      .map(
        (capability) =>
          `${capability.product}/core-capabilities/${capability.topic}`
      )
      .filter((key) => !manifestKeys.has(key));

    expect(unroutable).toEqual([]);
  });

  it('gives every registered capability a registry-owned content descriptor', () => {
    const moduleKeys = new Set(
      capabilityModules.map((module) => manifestKey(module.manifestIdentity))
    );

    const unwired = capabilities
      .map(
        (capability) =>
          `${capability.product}/core-capabilities/${capability.topic}`
      )
      .filter((key) => !moduleKeys.has(key));

    expect(unwired).toEqual([]);
  });

  it('points every cockpit module at a capability that still exists', () => {
    const capabilityKeys = new Set(
      capabilities.map(
        (capability) =>
          `${capability.product}/core-capabilities/${capability.topic}`
      )
    );

    const orphans = capabilityModules
      .map((module) => manifestKey(module.manifestIdentity))
      .filter((key) => !capabilityKeys.has(key));

    expect(orphans).toEqual([]);
  });

  it('keeps every registry product inside the CockpitProduct union', () => {
    // `cockpitManifest` is typed `CockpitManifestEntry[]`, so a product that is
    // not in the union cannot appear here — the runtime check is that the
    // registry's products are all representable in the manifest.
    const manifestProducts = new Set<string>(
      cockpitManifest.map((entry) => entry.product)
    );
    const registryProducts = [...new Set(capabilities.map((c) => c.product))];

    expect(registryProducts.filter((p) => !manifestProducts.has(p))).toEqual(
      []
    );
  });

  it('has no direct project references to capability example lanes', () => {
    const tsconfig = JSON.parse(
      readFileSync(resolveCockpitConfig('tsconfig.json'), 'utf8')
    ) as { references?: Array<{ path: string }> };

    expect(
      (tsconfig.references ?? []).filter((reference) =>
        reference.path.startsWith('../../cockpit/')
      )
    ).toEqual([]);
  });

  it('keeps redirect deployment inputs without tracing interactive content assets', () => {
    const project = JSON.parse(
      readFileSync(resolveCockpitConfig('project.json'), 'utf8')
    ) as {
      targets: { build: { inputs: string[] } };
      namedInputs: Record<string, string[]>;
    };

    expect(project.targets.build.inputs).toEqual([
      'default',
      'deploymentConfig',
      '^default',
    ]);
    expect(project.namedInputs['contentAssets']).toBeUndefined();
  });
});
