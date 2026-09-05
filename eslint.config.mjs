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
      '**/.install-collector/**',
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
            // The repo-root pricing config is shared with the website and
            // lives outside any Nx project on purpose.
            '^.*/pricing/tiers\\.config$',
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
  // Escalated to 'error' after v0.0.61 per the plan's two-step; every former
  // warning site now uses the escape hatch or a data-* state, so the rule
  // guards at zero suppressions.
  {
    files: ['apps/website/src/**/*.tsx'],
    ignores: [
      // Satori-rendered OG images: inline styles are the only mechanism there.
      'apps/website/src/app/opengraph-image.tsx',
      // NOTE: [slug] would be a glob character class, so match by wildcard.
      'apps/website/src/app/blog/*/opengraph-image.tsx',
      'apps/website/src/**/*.spec.tsx',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
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
