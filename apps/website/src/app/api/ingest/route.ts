import { PostHog } from 'posthog-node';
import { NextRequest, NextResponse } from 'next/server';
import { normalizePostHogHost, parseTelemetryEvent, toSafeAnalyticsString } from '@threadplane/telemetry/shared';
import { readBoundedBody } from '../_internal/read-bounded-body';

const PUBLIC_INGEST_KEY = 'phc_public_cacheplane_telemetry';
const MAX_BODY_BYTES = 16_384;
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
} as const;

interface TelemetryIngestPayload {
  key?: unknown;
  distinctId?: unknown;
  event?: unknown;
  properties?: unknown;
}

function getPostHogClient(): PostHog | null {
  const token = toSafeAnalyticsString(process.env.NEXT_PUBLIC_POSTHOG_TOKEN, 500);
  if (!token) return null;
  return new PostHog(token, {
    host: normalizePostHogHost(process.env.NEXT_PUBLIC_POSTHOG_HOST),
    flushAt: 1,
    flushInterval: 0,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readPayload(value: unknown): {
  distinctId: string;
  event: string;
  properties: Record<string, unknown>;
} | null {
  if (!isRecord(value)) return null;
  const payload = value as TelemetryIngestPayload;
  if (payload.key !== undefined && payload.key !== PUBLIC_INGEST_KEY) return null;

  const distinctId = toSafeAnalyticsString(payload.distinctId, 200);
  const parsed = parseTelemetryEvent(payload.event, payload.properties);
  if (!distinctId || !parsed) return null;

  return {
    distinctId,
    event: parsed.event,
    properties: parsed.properties,
  };
}

function jsonWithCors(body: unknown, init: { status: number }): NextResponse {
  return NextResponse.json(body, {
    ...init,
    headers: CORS_HEADERS,
  });
}

export function OPTIONS(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    const rawBody = await readBoundedBody(req, MAX_BODY_BYTES);
    if (rawBody === null) return jsonWithCors({ error: 'Invalid request body' }, { status: 413 });
    body = JSON.parse(rawBody);
  } catch {
    return jsonWithCors({ error: 'Invalid JSON' }, { status: 400 });
  }

  const payload = readPayload(body);
  if (!payload) {
    return jsonWithCors(
      { error: 'Invalid event payload' },
      { status: 400 }
    );
  }

  const posthog = getPostHogClient();
  if (!posthog) {
    return jsonWithCors(
      { error: 'Event ingest is not configured' },
      { status: 503 }
    );
  }

  try {
    posthog.capture({
      distinctId: payload.distinctId,
      event: payload.event,
      properties: {
        ...payload.properties,
        $ip: null,
        $process_person_profile: false,
      },
    });
    await posthog.shutdown();
    return jsonWithCors({ ok: true }, { status: 202 });
  } catch {
    console.error('[telemetry-ingest] capture failed');
    await posthog.shutdown().catch(() => undefined);
    return jsonWithCors(
      { error: 'Event ingest failed' },
      { status: 502 }
    );
  }
}
