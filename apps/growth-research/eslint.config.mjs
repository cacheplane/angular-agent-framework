import baseConfig from '../../eslint.config.mjs';

export default [
  { ignores: ['**/.dawn/**', '**/.deployment/**'] },
  ...baseConfig,
];
