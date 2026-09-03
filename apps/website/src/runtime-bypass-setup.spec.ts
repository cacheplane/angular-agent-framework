import { describe, expect, it } from 'vitest';
import runtimeBypassSetup, {
  RUNTIME_BYPASS_STORAGE_STATE,
  buildRuntimeBypassUrl,
  seedRuntimeBypass,
} from '../e2e/runtime-bypass-setup';

describe('runtime bypass setup', () => {
  it('asks Vercel for the bypass cookie at the runtime origin root', () => {
    expect(
      buildRuntimeBypassUrl(
        'https://threadplane-examples-pr-7-cacheplane.vercel.app',
        'examples-secret'
      )
    ).toBe(
      'https://threadplane-examples-pr-7-cacheplane.vercel.app/?x-vercel-protection-bypass=examples-secret&x-vercel-set-bypass-cookie=true'
    );
  });

  it('rejects a runtime origin that is not a bare https origin', () => {
    for (const origin of [
      'http://threadplane-examples-pr-7-cacheplane.vercel.app',
      'https://threadplane-examples-pr-7-cacheplane.vercel.app/langgraph',
      'https://user:pw@threadplane-examples-pr-7-cacheplane.vercel.app',
    ]) {
      expect(() => buildRuntimeBypassUrl(origin, 'examples-secret')).toThrow(
        /bare https origin/
      );
    }
  });

  it('does nothing when the origin or the secret is unset', async () => {
    await expect(seedRuntimeBypass({})).resolves.toBe('skipped');
    await expect(
      seedRuntimeBypass({ RUNTIME_BYPASS_ORIGIN: 'https://x.vercel.app' })
    ).resolves.toBe('skipped');
    await expect(
      seedRuntimeBypass({ VERCEL_EXAMPLES_AUTOMATION_BYPASS_SECRET: 's' })
    ).resolves.toBe('skipped');
  });

  it('ignores the config object Playwright hands to a global setup', async () => {
    // Playwright calls the default export with its FullConfig. Reading the
    // environment from that argument would silently skip the seeding.
    const saved = { ...process.env };
    delete process.env['RUNTIME_BYPASS_ORIGIN'];
    delete process.env['VERCEL_EXAMPLES_AUTOMATION_BYPASS_SECRET'];
    try {
      await expect(
        runtimeBypassSetup({
          RUNTIME_BYPASS_ORIGIN: 'https://x.vercel.app',
          VERCEL_EXAMPLES_AUTOMATION_BYPASS_SECRET: 's',
        } as never)
      ).resolves.toBe('skipped');
    } finally {
      process.env = saved;
    }
  });

  it('writes storage state under the gitignored test-results directory', () => {
    expect(RUNTIME_BYPASS_STORAGE_STATE).toMatch(
      /apps\/website\/test-results\/runtime-bypass-storage-state\.json$/
    );
  });
});
