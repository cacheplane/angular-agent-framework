import { describe, expect, it } from 'vitest';

import { createCanonicalPackageJson } from './assemble-dist.mjs';

describe('assemble-dist', () => {
  it('preserves publishConfig in the canonical dist manifest', () => {
    const manifest = createCanonicalPackageJson({
      name: '@ngaf/telemetry',
      version: '0.0.30',
      license: 'MIT',
      publishConfig: { access: 'public' },
      bin: { 'ngaf-telemetry-postinstall': './node/postinstall.js' },
    });

    expect(manifest.publishConfig).toEqual({ access: 'public' });
  });
});
