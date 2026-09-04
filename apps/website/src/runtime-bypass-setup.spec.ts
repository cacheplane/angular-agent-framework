import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { existsSync, readFileSync, rmSync } from 'node:fs';
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
      'https://threadplane-examples-pr-7-cacheplane.vercel.app/?x-vercel-protection-bypass=examples-secret&x-vercel-set-bypass-cookie=samesitenone'
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

  it('writes storage state under the gitignored dist directory', () => {
    expect(RUNTIME_BYPASS_STORAGE_STATE).toMatch(
      /dist\/apps\/website\/e2e-runtime-bypass\/storage-state\.json$/
    );
  });

  it('redacts the secret from a transport failure message', async () => {
    // Bind to a loopback port then close it immediately so the follow-up
    // request reliably fails fast (ECONNREFUSED) without a real listener.
    const probe = createServer();
    await new Promise<void>((res) => probe.listen(0, '127.0.0.1', res));
    const port = (probe.address() as AddressInfo).port;
    await new Promise<void>((res) => probe.close(() => res()));

    const secret = 'redact-me-please';
    await expect(
      seedRuntimeBypass({
        RUNTIME_BYPASS_ORIGIN: `http://127.0.0.1:${port}`,
        VERCEL_EXAMPLES_AUTOMATION_BYPASS_SECRET: secret,
      })
    ).rejects.toSatisfy((error: unknown) => {
      const message = (error as Error).message;
      return !message.includes(secret) && message.includes('***');
    });
  });

  it('allows http only for loopback hosts, rejecting it elsewhere', () => {
    for (const origin of [
      'http://localhost:4000',
      'http://127.0.0.1:4000',
      'http://[::1]:4000',
    ]) {
      expect(() => buildRuntimeBypassUrl(origin, 'secret')).not.toThrow();
    }
    expect(() =>
      buildRuntimeBypassUrl(
        'http://threadplane-examples-pr-7-cacheplane.vercel.app',
        'secret'
      )
    ).toThrow(/bare https origin/);
  });

  it('seeds a normalized, cross-site cookie from a loopback bypass response', async () => {
    rmSync(RUNTIME_BYPASS_STORAGE_STATE, { force: true });
    let requestPath: string | undefined;
    const server = createServer((req, res) => {
      requestPath = req.url;
      res.statusCode = 302;
      res.setHeader('Location', '/');
      res.setHeader(
        'Set-Cookie',
        '_vercel_jwt=abc123; Path=/; HttpOnly; SameSite=Lax'
      );
      res.end();
    });
    await new Promise<void>((res) => server.listen(0, '127.0.0.1', res));
    const port = (server.address() as AddressInfo).port;
    const secret = 'loopback-secret';

    try {
      await expect(
        seedRuntimeBypass({
          RUNTIME_BYPASS_ORIGIN: `http://127.0.0.1:${port}`,
          VERCEL_EXAMPLES_AUTOMATION_BYPASS_SECRET: secret,
        })
      ).resolves.toBe('seeded');

      expect(requestPath).toBe(
        `/?x-vercel-protection-bypass=${secret}&x-vercel-set-bypass-cookie=samesitenone`
      );

      expect(existsSync(RUNTIME_BYPASS_STORAGE_STATE)).toBe(true);
      const state = JSON.parse(
        readFileSync(RUNTIME_BYPASS_STORAGE_STATE, 'utf8')
      );
      const cookie = state.cookies.find(
        (c: { name: string }) => c.name === '_vercel_jwt'
      );
      expect(cookie).toMatchObject({
        value: 'abc123',
        sameSite: 'None',
        secure: true,
      });
    } finally {
      await new Promise<void>((res) => server.close(() => res()));
      rmSync(RUNTIME_BYPASS_STORAGE_STATE, { force: true });
    }
  });

  it('seeds a normalized cookie from a loopback 307 bypass response', async () => {
    rmSync(RUNTIME_BYPASS_STORAGE_STATE, { force: true });
    const server = createServer((_req, res) => {
      res.statusCode = 307;
      res.setHeader('Location', '/');
      res.setHeader(
        'Set-Cookie',
        '_vercel_jwt=abc307; Path=/; HttpOnly; SameSite=Lax'
      );
      res.end();
    });
    await new Promise<void>((res) => server.listen(0, '127.0.0.1', res));
    const port = (server.address() as AddressInfo).port;
    const secret = 'loopback-secret-307';

    try {
      await expect(
        seedRuntimeBypass({
          RUNTIME_BYPASS_ORIGIN: `http://127.0.0.1:${port}`,
          VERCEL_EXAMPLES_AUTOMATION_BYPASS_SECRET: secret,
        })
      ).resolves.toBe('seeded');

      expect(existsSync(RUNTIME_BYPASS_STORAGE_STATE)).toBe(true);
      const state = JSON.parse(
        readFileSync(RUNTIME_BYPASS_STORAGE_STATE, 'utf8')
      );
      const cookie = state.cookies.find(
        (c: { name: string }) => c.name === '_vercel_jwt'
      );
      expect(cookie).toMatchObject({
        value: 'abc307',
        sameSite: 'None',
        secure: true,
      });
    } finally {
      await new Promise<void>((res) => server.close(() => res()));
      rmSync(RUNTIME_BYPASS_STORAGE_STATE, { force: true });
    }
  });

  it('rejects with the status code when the loopback response sets no cookie', async () => {
    const server = createServer((_req, res) => {
      res.statusCode = 302;
      res.setHeader('Location', '/');
      res.end();
    });
    await new Promise<void>((res) => server.listen(0, '127.0.0.1', res));
    const port = (server.address() as AddressInfo).port;

    try {
      await expect(
        seedRuntimeBypass({
          RUNTIME_BYPASS_ORIGIN: `http://127.0.0.1:${port}`,
          VERCEL_EXAMPLES_AUTOMATION_BYPASS_SECRET: 'no-cookie-secret',
        })
      ).rejects.toThrow(/without a _vercel_jwt cookie/);
      await expect(
        seedRuntimeBypass({
          RUNTIME_BYPASS_ORIGIN: `http://127.0.0.1:${port}`,
          VERCEL_EXAMPLES_AUTOMATION_BYPASS_SECRET: 'no-cookie-secret',
        })
      ).rejects.toThrow(/302/);
    } finally {
      await new Promise<void>((res) => server.close(() => res()));
    }
  });
});
