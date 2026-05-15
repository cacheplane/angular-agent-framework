import { getAnonId } from '../shared/anon-id.js';
import { isTelemetryDisabled } from '../shared/env.js';
import { shouldSample } from '../shared/sample.js';
import type { NgafNodeEvent } from '../shared/events.js';
import { isProgrammaticallyDisabled } from './disable.js';

const DEFAULT_INGEST = 'https://cacheplane.ai/api/ingest';
const REQUEST_TIMEOUT_MS = 3_000;
// Public identifier accepted by the Cacheplane ingest proxy. The proxy re-keys
// server-side with the private PostHog token.
const PUBLIC_INGEST_KEY = 'phc_public_cacheplane_telemetry';

export type CaptureResult =
  | { sent: true }
  | { sent: false; reason: 'disabled' | 'sampled' | 'failed' };

export interface PostinstallInput {
  pkg: string;
  version: string;
}

function getSampleRate(env: NodeJS.ProcessEnv = process.env): number {
  const parsed = Number(env.NGAF_TELEMETRY_SAMPLE_RATE ?? '1');
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(0, Math.min(1, parsed));
}

function getPackageManager(env: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const userAgent = env.npm_config_user_agent;
  const firstToken = userAgent?.split(/\s+/)[0];
  const match = firstToken?.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (!match) return {};
  return {
    package_manager: match[1],
    package_manager_version: match[2],
  };
}

// @internal
export function createPostinstallProperties(
  input: PostinstallInput,
  env: NodeJS.ProcessEnv = process.env,
): Record<string, unknown> {
  return {
    pkg: input.pkg,
    version: input.version,
    node: process.version,
    os: process.platform,
    ...getPackageManager(env),
  };
}

async function postJson(url: string, body: unknown): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`telemetry ingest failed: ${res.status}`);
  } finally {
    clearTimeout(timeout);
  }
}

export async function captureEvent(
  event: NgafNodeEvent,
  properties: Record<string, unknown> = {},
): Promise<CaptureResult> {
  if (isTelemetryDisabled() || isProgrammaticallyDisabled()) return { sent: false, reason: 'disabled' };
  const rate = getSampleRate();
  const anonId = getAnonId();
  if (!shouldSample(rate, anonId)) return { sent: false, reason: 'sampled' };
  try {
    await postJson(process.env.NGAF_TELEMETRY_INGEST_URL ?? DEFAULT_INGEST, {
      key: PUBLIC_INGEST_KEY,
      distinctId: anonId,
      event,
      properties: { ...properties, sample_weight: rate > 0 ? 1 / Math.min(1, rate) : 1 },
    });
    return { sent: true };
  } catch {
    return { sent: false, reason: 'failed' };
  }
}

export async function capturePostinstall(input: PostinstallInput): Promise<CaptureResult> {
  return captureEvent('ngaf:postinstall', createPostinstallProperties(input));
}

// @internal — tests only
export function _resetClientForTesting(): void {
  // retained for older tests and downstream test helpers
}
