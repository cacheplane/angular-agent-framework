import { vi } from 'vitest';
// Growth's migration tests create a project-graph cycle through scripts, not a runtime dependency.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { ObservationError } from '@threadplane-internal/growth';
vi.mock('server-only', () => ({}));
import {
  createCollectionRoute,
  validateWebsiteCollection,
  type CollectionRouteDependencies,
} from './collection-route';
import { selectRuntimeAnnouncements } from './runtime-announcements';

function setup() {
  const close = vi.fn(async () => undefined);
  const deps = {
    environment: () => ({ GROWTH_COLLECTION_SOURCES: 'website' }),
    createDatabase: vi.fn(() => ({ close })),
    loadKeyring: () => ({ active: { version: 1, secret: 'x'.repeat(32) } }),
    now: () => new Date('2026-09-04T12:00:00Z'),
    sourceBudget: vi.fn(async () => ({ allowed: true, retryAfterSec: 30 })),
    subjectBudgets: vi.fn(async () => ({ allowed: true, retryAfterSec: 30 })),
    accept: vi.fn(async () => ({
      schemaVersion: 1,
      events: [
        {
          eventId: '11111111-1111-4111-8111-111111111111',
          disposition: 'accepted',
        },
      ],
    })),
    log: vi.fn(),
    validateWebsite: validateWebsiteCollection,
    runtimeAnnouncements: vi.fn<
      CollectionRouteDependencies['runtimeAnnouncements']
    >(() => [announcement]),
  };
  return {
    deps,
    handle: createCollectionRoute(
      deps as unknown as CollectionRouteDependencies
    ),
    close,
  };
}
const batch = {
  schemaVersion: 1,
  events: [
    {
      eventId: '11111111-1111-4111-8111-111111111111',
      kind: 'website.session_started',
      occurredAt: '2026-09-04T12:00:00Z',
      collectorVersion: '1',
      subject: {
        id: '22222222-2222-4222-8222-222222222222',
        namespace: 'website_session',
        scope: 'session',
      },
      properties: {},
    },
  ],
};
const request = (value: unknown = batch) =>
  new Request('https://example.invalid/api/growth/collect/v1/website', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(value),
  });
const announcement = {
  id: 'runtime-docs-v1',
  packageNames: ['@threadplane/langgraph'],
  minVersion: '0.0.0',
  expiresAt: '2027-09-04T00:00:00Z',
  text: 'Explore the Threadplane documentation.',
  documentationUrl: 'https://threadplane.ai/docs',
};
const runtimeBatch = {
  schemaVersion: 1,
  events: [
    {
      ...batch.events[0],
      kind: 'runtime.session_started',
      occurredAt: '2026-09-04T12:00:00.000Z',
      subject: { ...batch.events[0].subject, namespace: 'development_browser' },
      sessionId: '33333333-3333-4333-8333-333333333333',
      properties: {
        packageName: '@threadplane/langgraph',
        packageVersion: '0.0.65',
        integration: 'langgraph',
      },
    },
  ],
};
describe('runtime announcement exchange', () => {
  it.each(['0.0.65', 'unknown', '0.0.65-beta.1'])(
    'selects the public catalog using committed batch version %s',
    async (packageVersion) => {
      const { deps, handle } = setup();
      deps.environment = () => ({ GROWTH_COLLECTION_SOURCES: 'runtime' });
      deps.runtimeAnnouncements.mockImplementation(selectRuntimeAnnouncements);
      const event = runtimeBatch.events[0];
      const response = await handle(
        request({
          ...runtimeBatch,
          events: [
            { ...event, properties: { ...event.properties, packageVersion } },
          ],
        }),
        'runtime'
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.events).toEqual(
        (await deps.accept.mock.results[0].value).events
      );
      expect(body.announcements).toHaveLength(
        packageVersion === '0.0.65' ? 1 : 0
      );
    }
  );
  it('adds applicable announcements only after durable acceptance resolves', async () => {
    const { deps, handle } = setup();
    deps.environment = () => ({ GROWTH_COLLECTION_SOURCES: 'runtime' });
    let commit!: () => void;
    const acknowledgment = {
      schemaVersion: 1,
      events: [{ eventId: batch.events[0].eventId, disposition: 'accepted' }],
    };
    deps.accept.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          commit = () => resolve(acknowledgment);
        })
    );
    const pending = handle(request(runtimeBatch), 'runtime');
    await vi.waitFor(() => expect(deps.accept).toHaveBeenCalledOnce());
    expect(deps.runtimeAnnouncements).not.toHaveBeenCalled();
    commit();
    const response = await pending;
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ...acknowledgment,
      announcements: [announcement],
    });
    expect(deps.runtimeAnnouncements).toHaveBeenCalledWith(
      runtimeBatch,
      deps.now()
    );
  });
  it('preserves committed acknowledgment when catalog selection fails', async () => {
    const { deps, handle } = setup();
    deps.environment = () => ({ GROWTH_COLLECTION_SOURCES: 'runtime' });
    deps.runtimeAnnouncements.mockImplementation(() => {
      throw new Error('catalog unavailable');
    });
    const response = await handle(request(runtimeBatch), 'runtime');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ...(await deps.accept.mock.results[0].value),
      announcements: [],
    });
  });
  it('keeps website acknowledgments unchanged', async () => {
    const { deps, handle } = setup();
    const response = await handle(request(), 'website');
    expect(await response.json()).toEqual(
      await deps.accept.mock.results[0].value
    );
    expect(deps.runtimeAnnouncements).not.toHaveBeenCalled();
  });
  it.each(['disabled', 'invalid', 'failed acceptance'] as const)(
    'returns no announcements on %s',
    async (failure) => {
      const { deps, handle } = setup();
      deps.environment = () => ({
        GROWTH_COLLECTION_SOURCES: failure === 'disabled' ? '' : 'runtime',
      });
      if (failure === 'failed acceptance')
        deps.accept.mockRejectedValueOnce(new Error('database unavailable'));
      const response = await handle(
        request(failure === 'invalid' ? {} : runtimeBatch),
        'runtime'
      );
      expect(response.status).toBe(failure === 'invalid' ? 400 : 503);
      expect(await response.json()).not.toHaveProperty('announcements');
      expect(deps.runtimeAnnouncements).not.toHaveBeenCalled();
    }
  );
  it('provides credential-free preflight and browser-visible Retry-After', async () => {
    const { deps, handle } = setup();
    const preflight = await handle(
      new Request('https://example.invalid', { method: 'OPTIONS' }),
      'runtime'
    );
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-origin')).toBe('*');
    expect(preflight.headers.get('access-control-allow-methods')).toBe(
      'POST, OPTIONS'
    );
    expect(
      preflight.headers.get('access-control-allow-credentials')
    ).toBeNull();
    expect(deps.createDatabase).not.toHaveBeenCalled();
    const disabled = await handle(request(runtimeBatch), 'runtime');
    expect(disabled.headers.get('retry-after')).toBe('60');
    expect(disabled.headers.get('access-control-expose-headers')).toBe(
      'Retry-After'
    );
  });
});
describe('collection HTTP adapter', () => {
  it('rejects forged content and campaign metadata before durable acceptance', async () => {
    const { handle, deps } = setup();
    for (const properties of [
      { contentId: 'unknown-private-page', topic: 'other' },
      { contentId: 'home', topic: 'pricing' },
      { contentId: 'https://private.invalid?q=secret', topic: 'other' },
    ]) {
      expect(
        (
          await handle(
            request({
              ...batch,
              events: [
                {
                  ...batch.events[0],
                  kind: 'website.content_viewed',
                  properties,
                },
              ],
            }),
            'website'
          )
        ).status
      ).toBe(400);
    }
    for (const campaignSource of [
      'reader@example.invalid',
      'https://private.invalid',
      'private?query=secret',
    ])
      expect(
        (
          await handle(
            request({
              ...batch,
              events: [{ ...batch.events[0], properties: { campaignSource } }],
            }),
            'website'
          )
        ).status
      ).toBe(400);
    expect(deps.accept).not.toHaveBeenCalled();
    expect(
      (
        await handle(
          request({
            ...batch,
            events: [
              {
                ...batch.events[0],
                kind: 'website.content_viewed',
                properties: { contentId: 'home', topic: 'getting_started' },
              },
            ],
          }),
          'website'
        )
      ).status
    ).toBe(200);
  });
  it('cancels a stalled request body within its deadline', async () => {
    const { handle, deps } = setup();
    const cancel = vi.fn();
    const body = new ReadableStream({ cancel });
    const response = await handle(
      new Request('https://example.invalid', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        duplex: 'half',
      } as RequestInit),
      'website'
    );
    expect(response.status).toBe(413);
    await vi.waitFor(() => expect(cancel).toHaveBeenCalledOnce());
    expect(deps.accept).not.toHaveBeenCalled();
  });
  it('maps malformed JSON, content type, and atomic conflicts without leaking values', async () => {
    const { handle, deps } = setup();
    expect(
      (
        await handle(
          new Request('https://example.invalid', {
            method: 'POST',
            body: '{',
            headers: { 'content-type': 'application/json' },
          }),
          'website'
        )
      ).status
    ).toBe(400);
    expect(
      (
        await handle(
          new Request('https://example.invalid', {
            method: 'POST',
            body: '{}',
          }),
          'website'
        )
      ).status
    ).toBe(415);
    deps.accept.mockRejectedValueOnce(new ObservationError('event_conflict'));
    expect((await handle(request(), 'website')).status).toBe(409);
  });
  it('accepts identity-free website activity without an email keyring', async () => {
    const { deps, handle } = setup();
    deps.loadKeyring = () => {
      throw new Error('key unavailable');
    };
    expect((await handle(request(), 'website')).status).toBe(200);
  });
  it('treats an invalid server source configuration as unavailable', async () => {
    const { deps, handle } = setup();
    deps.environment = () => ({ GROWTH_COLLECTION_SOURCES: 'misspelled' });
    expect((await handle(request(), 'website')).status).toBe(503);
    expect(deps.createDatabase).not.toHaveBeenCalled();
  });
  it('does not acknowledge before the durable operation completes', async () => {
    const { deps, handle, close } = setup();
    let commit!: () => void;
    deps.accept.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          commit = () => resolve({ schemaVersion: 1, events: [] });
        })
    );
    const pending = handle(request(), 'website');
    let returned = false;
    pending.then(() => {
      returned = true;
    });
    await vi.waitFor(() => expect(deps.accept).toHaveBeenCalledOnce());
    expect(returned).toBe(false);
    commit();
    const response = await pending;
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(close).toHaveBeenCalledOnce();
  });
  it('fails closed when disabled and handles preflight without a database', async () => {
    const { deps, handle } = setup();
    deps.environment = () => ({ GROWTH_COLLECTION_SOURCES: '' });
    expect((await handle(request(), 'website')).status).toBe(503);
    expect(
      (
        await handle(
          new Request('https://example.invalid', { method: 'OPTIONS' }),
          'website'
        )
      ).status
    ).toBe(204);
    expect(deps.createDatabase).not.toHaveBeenCalled();
  });
  it('rejects unknown trust fields and charges source budget for invalid input', async () => {
    const { deps, handle } = setup();
    expect(
      (await handle(request({ ...batch, trust: 'server_verified' }), 'website'))
        .status
    ).toBe(400);
    expect(deps.sourceBudget).toHaveBeenCalledOnce();
    expect(deps.accept).not.toHaveBeenCalled();
  });
  it('does not reveal storage errors or private payloads', async () => {
    const { deps, handle } = setup();
    deps.accept.mockRejectedValueOnce(new Error('DO-NOT-LOG@example.invalid'));
    const response = await handle(request(), 'website');
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('DO-NOT-LOG');
    expect(JSON.stringify(deps.log.mock.calls)).not.toContain('DO-NOT-LOG');
  });
  it('reports quotas and closes the database', async () => {
    const { deps, handle, close } = setup();
    deps.sourceBudget.mockResolvedValueOnce({
      allowed: false,
      retryAfterSec: 30,
    });
    const response = await handle(request(), 'website');
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('30');
    expect(close).toHaveBeenCalledOnce();
  });
  it('rejects oversized bodies and unknown sources', async () => {
    const { handle, deps } = setup();
    expect(
      (await handle(request({ data: 'x'.repeat(65536) }), 'website')).status
    ).toBe(413);
    expect((await handle(request(), 'attacker')).status).toBe(404);
    expect(deps.accept).not.toHaveBeenCalled();
  });
});
