import { request } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Playwright globalSetup for runs whose Website preview embeds a runtime
 * from a second protected Vercel project. Deployment protection answers
 * every path on that origin with 302 -> vercel.com/sso-api, and Playwright's
 * extraHTTPHeaders is global, so the Website project's secret would reach
 * the runtime origin and be rejected. Vercel issues a per-origin `_vercel_jwt`
 * bypass cookie when a request carries the owning project's secret together
 * with `x-vercel-set-bypass-cookie=true`; this setup obtains that cookie once
 * and stores it as storage state, so every browser context carries it and
 * the runtime iframe and its subresources load. The examples secret travels
 * only in this one request.
 */
// Kept outside apps/website/test-results/ on purpose: other CI lanes upload
// that directory as a failure artifact, and this file holds a bearer cookie.
export const RUNTIME_BYPASS_STORAGE_STATE = resolve(
  __dirname,
  '..',
  '..',
  '..',
  'dist',
  'apps',
  'website',
  'e2e-runtime-bypass',
  'storage-state.json'
);

type SetupEnvironment = Readonly<Record<string, string | undefined>>;

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

function bareOriginError(origin: string): Error {
  return new Error(
    `RUNTIME_BYPASS_ORIGIN must be a bare https origin, received ${origin}`
  );
}

export function buildRuntimeBypassUrl(origin: string, secret: string): string {
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw bareOriginError(origin);
  }
  const isLoopbackHttp =
    parsed.protocol === 'http:' && LOOPBACK_HOSTNAMES.has(parsed.hostname);
  if (
    (parsed.protocol !== 'https:' && !isLoopbackHttp) ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== '/' ||
    parsed.search ||
    parsed.hash
  ) {
    throw bareOriginError(origin);
  }
  const url = new URL(parsed.origin);
  url.searchParams.set('x-vercel-protection-bypass', secret);
  url.searchParams.set('x-vercel-set-bypass-cookie', 'true');
  return url.toString();
}

export async function seedRuntimeBypass(
  environment: SetupEnvironment
): Promise<'skipped' | 'seeded'> {
  const origin = environment['RUNTIME_BYPASS_ORIGIN'];
  const secret = environment['VERCEL_EXAMPLES_AUTOMATION_BYPASS_SECRET'];
  if (!origin || !secret) return 'skipped';

  const context = await request.newContext();
  try {
    let response;
    try {
      // maxRedirects: 0 returns the 3xx instead of following it, and
      // Playwright stores Set-Cookie from that response before deciding
      // about redirects, which is what captures the cookie.
      response = await context.get(buildRuntimeBypassUrl(origin, secret), {
        maxRedirects: 0,
      });
    } catch (error) {
      const message = (error as Error).message.split(secret).join('***');
      throw new Error(`Runtime bypass setup: ${message}`);
    }
    const state = await context.storageState();
    const seeded = state.cookies.some(
      (cookie) => cookie.name === '_vercel_jwt'
    );
    if (!seeded) {
      throw new Error(
        `Runtime bypass setup: ${origin} answered ${response.status()} without a _vercel_jwt cookie. Check VERCEL_EXAMPLES_AUTOMATION_BYPASS_SECRET against the Vercel project that owns that origin.`
      );
    }
    // The runtime iframe is a cross-site navigation from the Website preview,
    // so the cookie must be SameSite=None (which requires Secure) or the
    // browser will never attach it to that navigation.
    const crossSiteState = {
      ...state,
      cookies: state.cookies.map((cookie) => ({
        ...cookie,
        sameSite: 'None' as const,
        secure: true,
      })),
    };
    mkdirSync(dirname(RUNTIME_BYPASS_STORAGE_STATE), { recursive: true });
    writeFileSync(RUNTIME_BYPASS_STORAGE_STATE, JSON.stringify(crossSiteState));
    return 'seeded';
  } finally {
    await context.dispose();
  }
}

// Playwright calls globalSetup with its FullConfig as the only argument.
// Read the environment from the process, never from that argument.
export default async function runtimeBypassSetup(): Promise<
  'skipped' | 'seeded'
> {
  return seedRuntimeBypass(process.env);
}
