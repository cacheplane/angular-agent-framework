import { composePlugins, withNx } from '@nx/next';
import type { WithNxOptions } from '@nx/next/plugins/with-nx';

export const nextConfig: WithNxOptions = {
  nx: {},
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
        {
          key: 'Access-Control-Allow-Origin',
          value: process.env.NEXT_PUBLIC_COCKPIT_IFRAME_ORIGIN ?? '*',
        },
        { key: 'Access-Control-Allow-Methods', value: 'POST, OPTIONS' },
        { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        { key: 'Access-Control-Max-Age', value: '86400' },
      ],
    },
  ],
};

const plugins = [withNx];

export default composePlugins(...plugins)(nextConfig);
