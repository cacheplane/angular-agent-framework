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
export const RUNTIME_BYPASS_STORAGE_STATE = resolve(
  __dirname,
  '..',
  'test-results',
  'runtime-bypass-storage-state.json'
);

type SetupEnvironment = Readonly<Record<string, string | undefined>>;

export function buildRuntimeBypassUrl(origin: string, secret: string): string {
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new Error(
      `RUNTIME_BYPASS_ORIGIN must be a bare https origin, received ${origin}`
    );
  }
  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== '/' ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(
      `RUNTIME_BYPASS_ORIGIN must be a bare https origin, received ${origin}`
    );
  }
  const url = new URL('/', parsed.origin);
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
    const response = await context.get(buildRuntimeBypassUrl(origin, secret), {
      maxRedirects: 0,
    });
    const state = await context.storageState();
    const seeded = state.cookies.some(
      (cookie) => cookie.name === '_vercel_jwt'
    );
    if (!seeded) {
      throw new Error(
        `Runtime bypass setup: ${origin} answered ${response.status()} without a _vercel_jwt cookie. Check VERCEL_EXAMPLES_AUTOMATION_BYPASS_SECRET against the Vercel project that owns that origin.`
      );
    }
    mkdirSync(dirname(RUNTIME_BYPASS_STORAGE_STATE), { recursive: true });
    writeFileSync(RUNTIME_BYPASS_STORAGE_STATE, JSON.stringify(state));
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
