import { getAnonId } from '../shared/anon-id.js';
import { isTelemetryDisabled } from '../shared/env.js';
import { shouldSample } from '../shared/sample.js';
import type { NgafNodeEvent } from '../shared/events.js';
import { isProgrammaticallyDisabled } from './disable.js';

const DEFAULT_INGEST = 'https://threadplane.ai/api/ingest';
const REQUEST_TIMEOUT_MS = 3_000;
// Public identifier accepted by the ThreadPlane ingest proxy. The proxy re-keys
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

function readBooleanToken(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  if (/^(1|true|yes)$/i.test(value)) return true;
  if (/^(0|false|no)$/i.test(value)) return false;
  return undefined;
}

function getPackageManager(
  env: NodeJS.ProcessEnv = process.env
): Record<string, unknown> {
  const userAgent = env.npm_config_user_agent;
  const tokens = userAgent?.split(/\s+/).filter(Boolean) ?? [];
  const firstToken = tokens[0];
  const match = firstToken?.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (!match) return {};

  const out: Record<string, unknown> = {
    package_manager: match[1],
    package_manager_version: match[2],
  };

  const nodeTokenIndex = tokens.findIndex((token) => token.startsWith('node/'));
  const nodeToken = nodeTokenIndex >= 0 ? tokens[nodeTokenIndex] : undefined;
  const nodeVersion = nodeToken?.match(/^node\/([^/\s]+)$/)?.[1];
  if (nodeVersion)
    out.package_manager_node_version = nodeVersion.replace(/^v/, '');

  if (nodeTokenIndex >= 0) {
    const platformTokens = tokens
      .slice(nodeTokenIndex + 1)
      .filter((token) => !token.includes('/'));
    if (platformTokens[0]) out.package_manager_os = platformTokens[0];
    if (platformTokens[1]) out.package_manager_arch = platformTokens[1];
  }

  const workspacesValue = tokens
    .find((token) => token.startsWith('workspaces/'))
    ?.split('/')[1];
  const workspaces = readBooleanToken(workspacesValue);
  if (workspaces !== undefined) out.package_manager_workspaces = workspaces;

  return out;
}

// @internal
export function createPostinstallProperties(
  input: PostinstallInput,
  env: NodeJS.ProcessEnv = process.env
): Record<string, unknown> {
  return {
    pkg: input.pkg,
    version: input.version,
    node: process.version,
    node_version: process.version,
    os: process.platform,
    arch: process.arch,
    global_install:
      readBooleanToken(env.npm_config_global) === true ||
      env.npm_config_location === 'global',
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
  properties: Record<string, unknown> = {}
): Promise<CaptureResult> {
  if (isTelemetryDisabled() || isProgrammaticallyDisabled())
    return { sent: false, reason: 'disabled' };
  const rate = getSampleRate();
  const anonId = getAnonId();
  if (!shouldSample(rate, anonId)) return { sent: false, reason: 'sampled' };
  try {
    await postJson(process.env.NGAF_TELEMETRY_INGEST_URL ?? DEFAULT_INGEST, {
      key: PUBLIC_INGEST_KEY,
      distinctId: anonId,
      event,
      properties: {
        ...properties,
        sample_weight: rate > 0 ? 1 / Math.min(1, rate) : 1,
      },
    });
    return { sent: true };
  } catch {
    return { sent: false, reason: 'failed' };
  }
}

export async function capturePostinstall(
  input: PostinstallInput
): Promise<CaptureResult> {
  return captureEvent('ngaf:postinstall', createPostinstallProperties(input));
}

// @internal — tests only
export function _resetClientForTesting(): void {
  // retained for older tests and downstream test helpers
}
