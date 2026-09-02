import { composePlugins, withNx } from '@nx/next';
import type { WithNxOptions } from '@nx/next/plugins/with-nx';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const cockpitAppDir = dirname(fileURLToPath(import.meta.url));

export const nextConfig: WithNxOptions = {
  nx: {},
  outputFileTracingRoot: join(cockpitAppDir, '../..'),
  skipTrailingSlashRedirect: true,
};

const plugins = [withNx];

export default composePlugins(...plugins)(nextConfig);
