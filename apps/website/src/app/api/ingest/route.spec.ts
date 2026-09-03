import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const capture = vi.fn();
const shutdown = vi.fn();

vi.mock('posthog-node', () => ({
  PostHog: vi.fn(function PostHog() {
    return { capture, shutdown };
  }),
}));

import { OPTIONS, POST } from './route';

describe('/api/ingest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_POSTHOG_TOKEN = 'phc_server';
    delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
  });

  it('accepts neutral browser telemetry payloads without requiring the public ingest key', async () => {
    shutdown.mockResolvedValue(undefined);
    const response = await POST(new Request('https://threadplane.ai/api/ingest', {
      method: 'POST',
      body: JSON.stringify({
        event: 'tplane:browser_chat_init',
        distinctId: 'browser:test',
        properties: { surface: 'canonical_demo' },
      }),
    }) as never);

    expect(response.status).toBe(202);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(capture).toHaveBeenCalledWith({
      distinctId: 'browser:test',
      event: 'tplane:browser_chat_init',
      properties: {
        surface: 'canonical_demo',
        $ip: null,
        $process_person_profile: false,
      },
    });
  });

  it('answers runtime telemetry preflight with the complete CORS contract', async () => {
    const response = await OPTIONS();

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(response.headers.get('access-control-allow-methods')).toBe(
      'POST, OPTIONS'
    );
    expect(response.headers.get('access-control-allow-headers')).toBe(
      'Content-Type, Authorization'
    );
    expect(response.headers.get('access-control-max-age')).toBe('86400');
  });

  it('returns CORS headers on rejected telemetry requests too', async () => {
    const response = await POST(
      new Request('https://threadplane.ai/api/ingest', {
        method: 'POST',
        body: '{bad json',
      }) as never
    );

    expect(response.status).toBe(400);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
  });
});

/**
 * The response bodies are public output; the log prefix and internal type names
 * are not. These pin the split so a future rename cannot leak one into the
 * other, in either direction.
 */
const INGEST_ROUTE_SOURCE = join(
  dirname(fileURLToPath(import.meta.url)),
  'route.ts'
);

describe('/api/ingest public response copy', () => {
  it.each([
    ['Invalid event payload'],
    ['Event ingest is not configured'],
    ['Event ingest failed'],
  ])('uses %s rather than product-specific wording', (expected) => {
    const source = readFileSync(INGEST_ROUTE_SOURCE, 'utf8');
    expect(source).toContain(expected);
  });

  it('keeps the internal log prefix untouched', () => {
    const source = readFileSync(INGEST_ROUTE_SOURCE, 'utf8');
    expect(source).toContain('[telemetry-ingest]');
  });

  it('exposes no product-specific wording in a response body', () => {
    const source = readFileSync(INGEST_ROUTE_SOURCE, 'utf8');
    for (const [, body] of source.matchAll(/error: '([^']+)'/gu)) {
      expect(body).not.toMatch(/telemetry/iu);
    }
  });
});
