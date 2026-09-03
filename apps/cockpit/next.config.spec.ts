import { describe, expect, it } from 'vitest';
import { nextConfig as config } from './next.config';

describe('cockpit next.config', () => {
  it('keeps exact trailing-slash paths visible to the redirect route', () => {
    expect(config.skipTrailingSlashRedirect).toBe(true);
  });

  it('does not retain interactive shell rewrites, headers, or content tracing', () => {
    expect(config.rewrites).toBeUndefined();
    expect(config.headers).toBeUndefined();
    expect(config.outputFileTracingIncludes).toBeUndefined();
  });
});
