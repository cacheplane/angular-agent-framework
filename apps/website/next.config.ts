import { composePlugins, withNx } from '@nx/next';
import type { WithNxOptions } from '@nx/next/plugins/with-nx';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const websiteAppDir = dirname(fileURLToPath(import.meta.url));

export const nextConfig: WithNxOptions = {
  // Use this to set Nx-specific options
  // See: https://nx.dev/recipes/next/next-config-setup
  nx: {},
  outputFileTracingRoot: join(websiteAppDir, '../..'),
  outputFileTracingIncludes: {
    '/*': [
      '../../cockpit/**/*.md',
      '../../cockpit/**/*.py',
      '../../cockpit/**/*.ts',
      '../../deployments/ag-ui-mastra/*.mjs',
      '../../nx.json',
    ],
  },
  skipTrailingSlashRedirect: true,
  rewrites: async () => [
    {
      source: '/ingest/static/:path*',
      destination: 'https://us-assets.i.posthog.com/static/:path*',
    },
    {
      source: '/ingest/:path*',
      destination: 'https://us.i.posthog.com/:path*',
    },
  ],
  headers: async () => [
    {
      source: '/ingest/:path*',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: '*' },
        { key: 'Access-Control-Allow-Methods', value: 'POST, OPTIONS' },
        {
          key: 'Access-Control-Allow-Headers',
          value: 'Content-Type, Authorization',
        },
        { key: 'Access-Control-Max-Age', value: '86400' },
      ],
    },
  ],
};

const plugins = [
  // Add more Next.js plugins to this list if needed.
  withNx,
];

export default composePlugins(...plugins)(nextConfig);
