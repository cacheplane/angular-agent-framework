import baseConfig from '../../eslint.config.mjs';

export default [
  { ignores: ['**/.dawn/**', '**/.deployment/**'] },
  ...baseConfig,
  {
    // Local evaluation uses the same browser capture as lifecycle.
    files: ['apps/growth-research/src/pilot/acquisition.ts'],
    rules: { '@nx/enforce-module-boundaries': 'off' },
  },
];
