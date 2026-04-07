import { describe, expect, it, vi } from 'vitest';
import { parseDeploySmokeArgs, runDeploySmoke } from './deploy-smoke';

describe('deploy smoke helper', () => {
  it('parses the deploy smoke command line', () => {
    expect(
      parseDeploySmokeArgs([
        '--url',
        'https://cockpit.cacheplane.ai',
        '--dry-run',
        '--retries',
        '5',
        '--retry-delay-ms',
        '1000',
      ])
    ).toEqual({
      url: 'https://cockpit.cacheplane.ai',
      expectedTitle: 'Cockpit',
      dryRun: true,
      retries: 5,
      retryDelayMs: 1000,
    });
  });

  it('formats dry-run output without performing a network request', async () => {
    await expect(
      runDeploySmoke({
        url: 'https://cockpit.cacheplane.ai',
        expectedTitle: 'Cockpit',
        dryRun: true,
      })
    ).resolves.toBe('dry-run:https://cockpit.cacheplane.ai:Cockpit');
  });

  it('retries until the deployment responds with the expected title', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('missing', { status: 404, statusText: 'Not Found' }))
      .mockResolvedValueOnce(
        new Response('<html><head><title>Cockpit</title></head><body>Cockpit</body></html>', {
          status: 200,
          statusText: 'OK',
        })
      );
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(
      runDeploySmoke({
        url: 'https://cockpit.cacheplane.ai',
        retries: 1,
        retryDelayMs: 1,
        fetchImpl,
        sleep,
      })
    ).resolves.toBe('pass:https://cockpit.cacheplane.ai:Cockpit');

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });
});
