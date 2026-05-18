import { beforeEach, describe, expect, it, vi } from 'vitest';

const capture = vi.fn();
const shutdown = vi.fn();

vi.mock('posthog-node', () => ({
  PostHog: vi.fn(function PostHog() {
    return { capture, shutdown };
  }),
}));

import { POST } from './route';

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
        event: 'ngaf:browser_chat_init',
        distinctId: 'browser:test',
        properties: { surface: 'canonical_demo' },
      }),
    }) as never);

    expect(response.status).toBe(202);
    expect(capture).toHaveBeenCalledWith({
      distinctId: 'browser:test',
      event: 'ngaf:browser_chat_init',
      properties: {
        surface: 'canonical_demo',
        $ip: null,
        $process_person_profile: false,
      },
    });
  });
});
