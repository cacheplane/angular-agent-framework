import { composePlugins, withNx } from '@nx/next';
import type { WithNxOptions } from '@nx/next/plugins/with-nx';

const nextConfig: WithNxOptions = {
  nx: {},
};

const plugins = [withNx];

export default composePlugins(...plugins)(nextConfig);
