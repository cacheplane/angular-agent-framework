import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: [
      '**/dist',
      '**/out-tsc',
      '**/.next',
      '**/.next/**',
      '**/.vercel',
      '**/.vercel/**',
      '**/next-env.d.ts',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: [
            '^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$',
            '^.*/libs/cockpit-(docs|registry|shell|testing|ui)/src/index$',
            // Repo-root pricing/ config files are shared between
            // apps/website and scripts/stripe; they live outside any
            // Nx project on purpose.
            '^.*/pricing/tiers\\.(config|generated)$',
          ],
          depConstraints: [
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*'],
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    // Override or add rules here
    rules: {},
  },
  // Inline-style guard — apps/website migrated off static inline styles
  // (docs/superpowers/specs/2026-08-29-inline-style-substrate-migration-design.md,
  // batches #848–#857). Flags identifier-keyed members of a style object
  // literal. The escape hatch for dynamic values — style={{ '--x': value }} —
  // uses string-literal keys and passes. Genuinely dynamic identifier-keyed
  // values (rare) get a targeted eslint-disable-next-line with a reason.
  // Ships as 'warn' for one release, then 'error'.
  {
    files: ['apps/website/src/**/*.tsx'],
    ignores: [
      // Satori-rendered OG images: inline styles are the only mechanism there.
      'apps/website/src/app/opengraph-image.tsx',
      // NOTE: [slug] would be a glob character class, so match by wildcard.
      'apps/website/src/app/blog/*/opengraph-image.tsx',
      // Dev-only route slated for deletion.
      'apps/website/src/app/dev/primitives/page.tsx',
      'apps/website/src/**/*.spec.tsx',
    ],
    rules: {
      'no-restricted-syntax': [
        'warn',
        {
          selector:
            'JSXAttribute[name.name="style"] > JSXExpressionContainer > ObjectExpression > Property[key.type="Identifier"]',
          message:
            "Static presentation belongs in src/styles/*.css (see the substrate-migration spec). For dynamic values, set a CSS custom property: style={{ '--x': value }}.",
        },
      ],
    },
  },
];
