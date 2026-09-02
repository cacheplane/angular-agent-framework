import { describe, expect, it, vi } from 'vitest';
import {
  getRegistryWebsiteDestinations,
  getRedirectDisabledProbePath,
  parseDeploySmokeArgs,
  runDeploySmoke,
} from './deploy-smoke';

describe('deploy smoke helper', () => {
  it('parses the deploy smoke command line', () => {
    expect(
      parseDeploySmokeArgs([
        '--url',
        'https://cockpit.threadplane.ai',
        '--dry-run',
        '--retries',
        '5',
        '--retry-delay-ms',
        '1000',
        '--website-url',
        'https://threadplane.ai',
      ])
    ).toEqual({
      url: 'https://cockpit.threadplane.ai',
      websiteUrl: 'https://threadplane.ai',
      expectedTitle: 'Cockpit',
      dryRun: true,
      retries: 5,
      retryDelayMs: 1000,
    });
  });

  it('derives unique canonical Website destinations from the registry', () => {
    const destinations = getRegistryWebsiteDestinations();

    expect(destinations).toContain('/docs/langgraph/guides/streaming');
    expect(destinations).toContain('/workspace/langgraph/durable-execution');
    expect(destinations).toContain(
      '/docs/deep-agents/capabilities/planning'
    );
    expect(destinations).not.toContain('/workspace/deep-agents/overview');
    expect(destinations).toEqual([...destinations].sort());
    expect(new Set(destinations).size).toBe(destinations.length);
  });

  it('uses a registry-owned legacy route to prove redirects remain disabled', () => {
    expect(getRedirectDisabledProbePath()).toBe(
      '/langgraph/core-capabilities/streaming/overview/python'
    );
  });

  it('formats dry-run output without performing a network request', async () => {
    await expect(
      runDeploySmoke({
        url: 'https://cockpit.threadplane.ai',
        expectedTitle: 'Cockpit',
        dryRun: true,
      })
    ).resolves.toBe('dry-run:https://cockpit.threadplane.ai:Cockpit');
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
        url: 'https://cockpit.threadplane.ai',
        retries: 1,
        retryDelayMs: 1,
        fetchImpl,
        sleep,
      })
    ).resolves.toBe('pass:https://cockpit.threadplane.ai:Cockpit');

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('verifies every canonical Website destination and the default-off redirect gate', async () => {
    const cockpitUrl = 'https://cockpit.threadplane.ai';
    const websiteUrl = 'https://threadplane.ai';
    const destinations = getRegistryWebsiteDestinations();
    const redirectProbe = getRedirectDisabledProbePath();
    const fetchImpl = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const requestedUrl = String(input);
        if (requestedUrl === cockpitUrl) {
          return new Response('<title>Cockpit</title>', { status: 200 });
        }
        if (requestedUrl === `${cockpitUrl}${redirectProbe}`) {
          expect(init?.redirect).toBe('manual');
          return new Response('<title>Cockpit</title>', { status: 200 });
        }
        return new Response('<title>Threadplane</title>', { status: 200 });
      }
    ) as unknown as typeof fetch;

    await expect(
      runDeploySmoke({
        url: cockpitUrl,
        websiteUrl,
        fetchImpl,
      })
    ).resolves.toBe(
      `pass:${cockpitUrl}:Cockpit:website:${destinations.length}:redirects-off`
    );

    expect(fetchImpl).toHaveBeenCalledTimes(destinations.length + 2);
    for (const destination of destinations) {
      expect(fetchImpl).toHaveBeenCalledWith(`${websiteUrl}${destination}`);
    }
    expect(fetchImpl).toHaveBeenCalledWith(`${cockpitUrl}${redirectProbe}`, {
      redirect: 'manual',
    });
  });
});
