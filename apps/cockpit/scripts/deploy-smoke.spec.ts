import { cockpitManifest } from '@threadplane/cockpit-registry';
import { createServer } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import {
  RAW_MALFORMED_REQUEST_TARGETS,
  buildRedirectSmokeCases,
  parseDeploySmokeArgs,
  requestExactTarget,
  runDeploySmoke,
  type RedirectSmokeRequest,
  type RedirectSmokeResponse,
} from './deploy-smoke';

const previewUrl = 'https://immutable-preview.vercel.app';

const responseFor = (
  request: RedirectSmokeRequest,
  cases = buildRedirectSmokeCases('preview')
): RedirectSmokeResponse => {
  const smokeCase = cases.find(
    (candidate) =>
      candidate.path === request.path &&
      JSON.stringify(candidate.headers ?? {}) ===
        JSON.stringify(request.headers ?? {})
  );
  if (!smokeCase) throw new Error(`Unexpected request ${request.path}`);
  return {
    status: smokeCase.expectedStatus,
    headers: smokeCase.expectedLocation
      ? { location: smokeCase.expectedLocation }
      : {},
  };
};

describe('redirect deploy smoke contract', () => {
  it('parses explicit preview and production modes', () => {
    expect(
      parseDeploySmokeArgs([
        '--url',
        previewUrl,
        '--mode',
        'preview',
        '--dry-run',
        '--retries',
        '5',
        '--retry-delay-ms',
        '1000',
      ])
    ).toEqual({
      url: previewUrl,
      mode: 'preview',
      dryRun: true,
      retries: 5,
      retryDelayMs: 1000,
    });

    expect(
      parseDeploySmokeArgs([
        '--url',
        'https://cockpit.threadplane.ai',
        '--mode',
        'production',
      ]).mode
    ).toBe('production');
    expect(() => parseDeploySmokeArgs(['--mode', 'other'])).toThrow(
      /--mode must be preview or production/
    );
  });

  it('enumerates every registry path and mode in exhaustive preview mode', () => {
    const cases = buildRedirectSmokeCases('preview');

    for (const entry of cockpitManifest) {
      expect(
        cases.some(
          (smokeCase) =>
            smokeCase.path === entry.legacyPath &&
            smokeCase.expectedStatus === 308
        ),
        `${entry.id} missing default redirect probe`
      ).toBe(true);
      for (const mode of entry.availableModes) {
        expect(
          cases.some(
            (smokeCase) =>
              smokeCase.path ===
                `${entry.legacyPath}?mode=${mode.toLowerCase()}` &&
              smokeCase.expectedStatus === 308
          ),
          `${entry.id} missing ${mode} redirect probe`
        ).toBe(true);
      }
      expect(
        cases.some(
          (smokeCase) => smokeCase.path === `${entry.legacyPath}?mode=invalid`
        ),
        `${entry.id} missing invalid-mode probe`
      ).toBe(true);
      expect(
        cases.some(
          (smokeCase) =>
            smokeCase.path === `${entry.legacyPath}?mode=docs&mode=run`
        ),
        `${entry.id} missing duplicate-mode probe`
      ).toBe(true);
    }

    const rootLocation =
      'https://threadplane.ai/docs/langgraph/guides/streaming?mode=run';
    for (const path of [
      '/',
      '/?mode=docs',
      '/?mode=run',
      '/?mode=code',
      '/?mode=api',
      '/?mode=invalid',
      '/?mode=docs&mode=run',
      '/?return_to=https%3A%2F%2Fattacker.test&utm_source=legacy',
    ]) {
      expect(cases).toContainEqual(
        expect.objectContaining({
          path,
          expectedStatus: 308,
          expectedLocation: rootLocation,
        })
      );
    }
    expect(
      cases.some((smokeCase) => smokeCase.name.includes('unavailable mode'))
    ).toBe(true);
    expect(
      cases.some(
        (smokeCase) =>
          smokeCase.name.includes('unrelated query') &&
          !smokeCase.expectedLocation?.includes('return_to')
      )
    ).toBe(true);
    expect(
      cases.every(
        (smokeCase) =>
          !Object.keys(smokeCase.headers ?? {}).some(
            (header) => header.toLowerCase() === 'host'
          )
      )
    ).toBe(true);

    expect(cases).toContainEqual(
      expect.objectContaining({
        name: 'hostile forwarding headers ignored',
        path: '/langgraph/core-capabilities/streaming/overview/python',
        headers: {
          forwarded: 'host=attacker.test;proto=http',
          'x-forwarded-host': 'attacker.test',
          'x-forwarded-proto': 'http',
          referer: 'https://attacker.test/redirect',
        },
        expectedStatus: 308,
        expectedLocation:
          'https://threadplane.ai/docs/langgraph/guides/streaming?mode=run',
      })
    );
  });

  it('sends every malformed request target as an exact 404 probe', () => {
    const cases = buildRedirectSmokeCases('preview');

    expect(RAW_MALFORMED_REQUEST_TARGETS).toEqual(
      expect.arrayContaining([
        expect.stringContaining('//'),
        expect.stringContaining('\\'),
        expect.stringContaining('/./'),
        expect.stringContaining('/../'),
        expect.stringContaining('%2e'),
        expect.stringContaining('%2F'),
      ])
    );
    for (const path of RAW_MALFORMED_REQUEST_TARGETS) {
      expect(cases).toContainEqual(
        expect.objectContaining({
          path,
          expectedStatus: 404,
          raw: true,
        })
      );
    }
  });

  it('keeps production mode representative and includes raw canaries', () => {
    const cases = buildRedirectSmokeCases('production');

    expect(cases.length).toBeLessThan(
      buildRedirectSmokeCases('preview').length
    );
    for (const label of [
      'root',
      'Docs-backed',
      'unknown',
      'favicon',
      'raw malformed',
    ]) {
      expect(
        cases.some((smokeCase) => smokeCase.name.includes(label)),
        `missing ${label}`
      ).toBe(true);
    }
  });

  it('uses the injected low-level transport without normalizing request targets', async () => {
    const cases = buildRedirectSmokeCases('preview');
    const requestImpl = vi.fn(async (request: RedirectSmokeRequest) =>
      responseFor(request, cases)
    );

    await expect(
      runDeploySmoke({
        url: previewUrl,
        mode: 'preview',
        requestImpl,
      })
    ).resolves.toBe(`pass:preview:${previewUrl}:${cases.length}`);

    for (const path of RAW_MALFORMED_REQUEST_TARGETS) {
      expect(requestImpl).toHaveBeenCalledWith(
        expect.objectContaining({ origin: previewUrl, path })
      );
    }
  });

  it('writes malformed paths unchanged onto the Node HTTP request line', async () => {
    const received: string[] = [];
    const server = createServer((request, response) => {
      received.push(request.url ?? '');
      response.statusCode = 404;
      response.end();
    });
    await new Promise<void>((resolvePromise) =>
      server.listen(0, '127.0.0.1', resolvePromise)
    );

    try {
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Expected a TCP test server address');
      }
      const origin = `http://127.0.0.1:${address.port}`;
      for (const path of RAW_MALFORMED_REQUEST_TARGETS) {
        await requestExactTarget({ origin, path });
      }
      expect(received).toEqual(RAW_MALFORMED_REQUEST_TARGETS);
    } finally {
      await new Promise<void>((resolvePromise, reject) =>
        server.close((error) => (error ? reject(error) : resolvePromise()))
      );
    }
  });

  it('reports a deterministic contract mismatch immediately without retrying', async () => {
    const requestImpl = vi.fn(async () => ({ status: 200, headers: {} }));
    const sleep = vi.fn();

    await expect(
      runDeploySmoke({
        url: previewUrl,
        mode: 'preview',
        retries: 4,
        requestImpl,
        sleep,
      })
    ).rejects.toThrow(/preview.*root.*expected 308.*received 200/i);
    expect(requestImpl).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries transport failures and identifies the failing raw case', async () => {
    const cases = buildRedirectSmokeCases('production');
    const rawCase = cases.find((smokeCase) => smokeCase.raw);
    if (!rawCase) throw new Error('Expected production raw canary');

    const requestImpl = vi.fn(async (request: RedirectSmokeRequest) => {
      if (request.path === rawCase.path) {
        throw new Error('socket reset');
      }
      return responseFor(request, cases);
    });
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(
      runDeploySmoke({
        url: 'https://cockpit.threadplane.ai',
        mode: 'production',
        retries: 1,
        retryDelayMs: 1,
        requestImpl,
        sleep,
      })
    ).rejects.toThrow(
      new RegExp(`production.*${rawCase.name}.*socket reset`, 'i')
    );
    expect(
      requestImpl.mock.calls.filter(
        ([request]) => request.path === rawCase.path
      )
    ).toHaveLength(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('identifies the raw-path rejection route when a raw canary is normalized', async () => {
    const cases = buildRedirectSmokeCases('production');
    const requestImpl = vi.fn(async (request: RedirectSmokeRequest) => {
      const smokeCase = cases.find(
        (candidate) => candidate.path === request.path
      );
      if (!smokeCase) throw new Error(`Unexpected request ${request.path}`);
      if (smokeCase.raw) return { status: 308, headers: {} };
      return responseFor(request, cases);
    });

    await expect(
      runDeploySmoke({
        url: 'https://cockpit.threadplane.ai',
        mode: 'production',
        requestImpl,
      })
    ).rejects.toThrow(/vercel\.cockpit\.json/);
  });

  it('accepts only the platform same-origin slash collapse for a consecutive-slash probe', async () => {
    // Vercel's CDN collapses consecutive slashes and answers 308 to the
    // single-slash path on the same origin before any route, rewrite, or
    // function runs, so that probe can never reach the 404 route. The only
    // acceptable non-404 answer is that exact normalization; a redirect off
    // the deployment from a malformed path is still a contract failure.
    const cases = buildRedirectSmokeCases('preview');
    const slashCase = cases.find(
      (smokeCase) => smokeCase.raw && smokeCase.path.includes('//')
    );
    const dotCase = cases.find(
      (smokeCase) => smokeCase.raw && smokeCase.path.includes('/./')
    );
    if (!slashCase || !dotCase) throw new Error('Expected raw canaries');
    expect(slashCase.platformNormalizedPath).toBe(
      '/langgraph/core-capabilities/streaming/overview/python'
    );
    expect(dotCase.platformNormalizedPath).toBeUndefined();

    const impl = (answer: (request: RedirectSmokeRequest) => RedirectSmokeResponse | null) =>
      vi.fn(async (request: RedirectSmokeRequest) =>
        answer(request) ?? responseFor(request, cases)
      );

    await expect(
      runDeploySmoke({
        url: previewUrl,
        mode: 'preview',
        requestImpl: impl((request) =>
          request.path === slashCase.path
            ? {
                status: 308,
                // The platform answers with a relative Location.
                headers: {
                  location:
                    '/langgraph/core-capabilities/streaming/overview/python',
                },
              }
            : null
        ),
      })
    ).resolves.toBe(`pass:preview:${previewUrl}:${cases.length}`);

    await expect(
      runDeploySmoke({
        url: previewUrl,
        mode: 'preview',
        requestImpl: impl((request) =>
          request.path === slashCase.path
            ? {
                status: 308,
                headers: {
                  location: `${previewUrl}/langgraph/core-capabilities/streaming/overview/python`,
                },
              }
            : null
        ),
      })
    ).resolves.toBe(`pass:preview:${previewUrl}:${cases.length}`);

    await expect(
      runDeploySmoke({
        url: previewUrl,
        mode: 'preview',
        requestImpl: impl((request) =>
          request.path === slashCase.path
            ? {
                status: 308,
                headers: {
                  location:
                    'https://threadplane.ai/docs/langgraph/guides/streaming?mode=run',
                },
              }
            : null
        ),
      })
    ).rejects.toThrow(/raw malformed 1.*expected 404, received 308/);

    await expect(
      runDeploySmoke({
        url: previewUrl,
        mode: 'preview',
        requestImpl: impl((request) =>
          request.path === dotCase.path
            ? {
                status: 308,
                headers: {
                  location: `${previewUrl}/langgraph/core-capabilities/streaming/overview/python`,
                },
              }
            : null
        ),
      })
    ).rejects.toThrow(/expected 404, received 308/);
  });

  it('sends the automation bypass on every probe only when a secret is supplied', async () => {
    // Vercel deployment protection answers every path on an unaliased
    // deployment with 302 -> vercel.com/sso-api, so the immutable cockpit
    // artifact can only be verified with the project's automation bypass.
    const cases = buildRedirectSmokeCases('preview');
    const withSecret = vi.fn(async (request: RedirectSmokeRequest) => {
      const { 'x-vercel-protection-bypass': bypass, ...rest } =
        request.headers ?? {};
      if (bypass !== 'cockpit-bypass-sentinel') {
        throw new Error(`Missing bypass on ${request.path}`);
      }
      return responseFor(
        { ...request, headers: Object.keys(rest).length ? rest : undefined },
        cases
      );
    });

    await expect(
      runDeploySmoke({
        url: previewUrl,
        mode: 'preview',
        requestImpl: withSecret,
        bypassSecret: 'cockpit-bypass-sentinel',
      })
    ).resolves.toBe(`pass:preview:${previewUrl}:${cases.length}`);
    expect(withSecret).toHaveBeenCalledTimes(cases.length);
    expect(withSecret).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/langgraph/core-capabilities/streaming/overview/python',
        headers: expect.objectContaining({
          'x-forwarded-host': 'attacker.test',
          'x-vercel-protection-bypass': 'cockpit-bypass-sentinel',
        }),
      })
    );

    const withoutSecret = vi.fn(async (request: RedirectSmokeRequest) =>
      responseFor(request, cases)
    );
    await runDeploySmoke({
      url: previewUrl,
      mode: 'preview',
      requestImpl: withoutSecret,
    });
    for (const [request] of withoutSecret.mock.calls) {
      expect(request.headers ?? {}).not.toHaveProperty(
        'x-vercel-protection-bypass'
      );
    }
  });

  it('names Vercel deployment protection when a probe lands on the SSO redirect', async () => {
    const requestImpl = vi.fn(async () => ({
      status: 302,
      headers: {
        location:
          'https://vercel.com/sso-api?url=https%3A%2F%2Fimmutable-preview.vercel.app%2F&nonce=abc',
      },
    }));

    await expect(
      runDeploySmoke({ url: previewUrl, mode: 'preview', requestImpl })
    ).rejects.toThrow(
      /expected 308, received 302.*deployment protection.*automation bypass/i
    );
  });

  it('formats dry-run output with the selected mode and case count', async () => {
    await expect(
      runDeploySmoke({ url: previewUrl, mode: 'preview', dryRun: true })
    ).resolves.toBe(
      `dry-run:preview:${previewUrl}:${
        buildRedirectSmokeCases('preview').length
      }`
    );
  });
});
