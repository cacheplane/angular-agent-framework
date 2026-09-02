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
