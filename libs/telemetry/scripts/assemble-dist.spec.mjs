import { describe, expect, it } from 'vitest';

import { createCanonicalPackageJson } from './assemble-dist.mjs';

describe('assemble-dist', () => {
  it('preserves publishConfig in the canonical dist manifest', () => {
    const manifest = createCanonicalPackageJson({
      name: '@threadplane/telemetry',
      version: '0.0.30',
      license: 'MIT',
      publishConfig: { access: 'public' },
      bin: { 'threadplane-telemetry-postinstall': './node/postinstall.js' },
    });

    expect(manifest.publishConfig).toEqual({ access: 'public' });
  });
});
