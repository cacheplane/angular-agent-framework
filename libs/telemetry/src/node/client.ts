import { PostHog } from 'posthog-node';
import { getAnonId } from '../shared/anon-id.js';
import { isTelemetryDisabled } from '../shared/env.js';
import { shouldSample } from '../shared/sample.js';
import type { NgafNodeEvent } from '../shared/events.js';
import { isProgrammaticallyDisabled } from './disable.js';

const DEFAULT_INGEST = 'https://cacheplane.dev/api/ingest';
// This token is the public Cacheplane PostHog project key (the proxy strips it
// and re-keys server-side). It's a Project API key, not a Personal API key, so
// it's safe to ship in OSS code.
const PUBLIC_INGEST_KEY = 'phc_public_cacheplane_telemetry';

let cached: PostHog | null = null;

function getClient(): PostHog | null {
  if (cached) return cached;
  if (isTelemetryDisabled() || isProgrammaticallyDisabled()) return null;
  const host = process.env.NGAF_TELEMETRY_INGEST_URL ?? DEFAULT_INGEST;
  cached = new PostHog(PUBLIC_INGEST_KEY, {
    host,
    flushAt: 1,
    flushInterval: 0,
  });
  return cached;
}

export async function captureEvent(event: NgafNodeEvent, properties: Record<string, unknown> = {}): Promise<void> {
  const client = getClient();
  if (!client) return;
  const rate = Number(process.env.NGAF_TELEMETRY_SAMPLE_RATE ?? '1');
  const anonId = getAnonId();
  if (!shouldSample(rate, anonId)) return;
  try {
    client.capture({
      distinctId: anonId,
      event,
      properties: { ...properties, sample_weight: rate > 0 ? 1 / Math.min(1, rate) : 1 },
    });
    await client.shutdown();
  } catch {
    // silent fail
  } finally {
    cached = null;  // fresh client per process; flushAt:1 means we're done
  }
}

export async function capturePostinstall(input: { pkg: string; version: string }): Promise<void> {
  await captureEvent('ngaf:postinstall', {
    pkg: input.pkg,
    version: input.version,
    node: process.version,
    os: process.platform,
  });
}

// @internal — tests only
export function _resetClientForTesting(): void {
  cached = null;
}
