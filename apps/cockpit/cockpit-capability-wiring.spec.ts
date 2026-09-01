import { cockpitManifest } from '@threadplane/cockpit-registry';
import { capabilities } from './scripts/capability-registry';
import {
  buildNavigationTree,
  capabilityModules,
} from './src/lib/route-resolution';

/**
 * The cockpit site is assembled from three lists that nothing forced to agree:
 *
 *  - `apps/cockpit/scripts/capability-registry.ts` — what serve/build/deploy know about;
 *  - `libs/cockpit-registry` `cockpitManifest` — what the Next route can resolve;
 *  - `capabilityModules` in `route-resolution.ts` — what supplies a page's assets.
 *
 * When the `runtimes` product shipped, only the first list learned about it, so
 * `/runtimes/core-capabilities/<topic>/overview/<lang>` threw
 * "No manifest entry found …" and every runtime page 500'd in production while
 * the whole suite stayed green. These assertions are the missing coupling.
 */
describe('cockpit capability wiring', () => {
  const manifestKey = (e: { product: string; section: string; topic: string }) =>
    `${e.product}/${e.section}/${e.topic}`;

  it('gives every registered capability a resolvable manifest entry', () => {
    const manifestKeys = new Set(cockpitManifest.map(manifestKey));

    const unroutable = capabilities
      .map((capability) => `${capability.product}/core-capabilities/${capability.topic}`)
      .filter((key) => !manifestKeys.has(key));

    expect(unroutable).toEqual([]);
  });

  it('gives every registered capability a cockpit module in route-resolution', () => {
    const moduleKeys = new Set(
      capabilityModules.map((module) => manifestKey(module.manifestIdentity))
    );

    const unwired = capabilities
      .map((capability) => `${capability.product}/core-capabilities/${capability.topic}`)
      .filter((key) => !moduleKeys.has(key));

    expect(unwired).toEqual([]);
  });

  it('points every cockpit module at a capability that still exists', () => {
    const capabilityKeys = new Set(
      capabilities.map(
        (capability) => `${capability.product}/core-capabilities/${capability.topic}`
      )
    );

    const orphans = capabilityModules
      .map((module) => manifestKey(module.manifestIdentity))
      .filter((key) => !capabilityKeys.has(key));

    expect(orphans).toEqual([]);
  });

  it('surfaces every manifest product in the navigation tree', () => {
    const manifestProducts = [...new Set(cockpitManifest.map((entry) => entry.product))];
    const navigationProducts = buildNavigationTree(cockpitManifest).map(
      (product) => product.product
    );

    expect([...manifestProducts].sort()).toEqual([...navigationProducts].sort());

    for (const product of buildNavigationTree(cockpitManifest)) {
      const entries = product.sections.flatMap((section) => section.entries);
      expect({ product: product.product, empty: entries.length === 0 }).toEqual({
        product: product.product,
        empty: false,
      });
    }
  });

  it('keeps every registry product inside the CockpitProduct union', () => {
    // `cockpitManifest` is typed `CockpitManifestEntry[]`, so a product that is
    // not in the union cannot appear here — the runtime check is that the
    // registry's products are all representable in the manifest.
    const manifestProducts = new Set<string>(cockpitManifest.map((entry) => entry.product));
    const registryProducts = [...new Set(capabilities.map((c) => c.product))];

    expect(registryProducts.filter((p) => !manifestProducts.has(p))).toEqual([]);
  });
});
