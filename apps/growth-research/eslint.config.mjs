import baseConfig from '../../eslint.config.mjs';

export default [
  { ignores: ['**/.dawn/**', '**/.deployment/**'] },
  ...baseConfig,
  {
    // Local-only benchmark adapters exercise the exact lifecycle baseline.
    // They are excluded from the standalone deployment; copying it would bias comparisons.
    files: [
      'apps/growth-research/src/pilot/baseline.ts',
      'apps/growth-research/src/pilot/acquisition.ts',
    ],
    rules: { '@nx/enforce-module-boundaries': 'off' },
  },
];
