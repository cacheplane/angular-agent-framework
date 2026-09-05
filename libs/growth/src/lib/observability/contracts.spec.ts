import { parseCollectionBatch } from './contracts.ts';

export const now = new Date('2026-09-04T12:00:00.000Z');
export function installFixture() {
  return {
    schemaVersion: 1,
    events: [
      {
        eventId: '11111111-1111-4111-8111-111111111111',
        kind: 'package.installed',
        occurredAt: now.toISOString(),
        collectorVersion: '1.0.0',
        subject: {
          id: '22222222-2222-4222-8222-222222222222',
          namespace: 'installation',
          scope: 'persistent',
        },
        properties: {
          packageName: '@threadplane/chat',
          packageVersion: '0.0.65',
          osFamily: 'linux',
          architecture: 'x64',
          nodeVersion: '22.0.0',
          environment: 'ci',
          environmentEvidence: 'github_actions',
          ciProvider: 'github_actions',
        },
        identity: {
          gitEmail: ' Developer@Example.Invalid ',
          gitDisplayName: 'Developer',
          gitConfigOrigin: 'global',
        },
      },
    ],
  };
}

describe('collection contract', () => {
  it.each([
    ['local', 'interactive_package_manager'],
    ['ci', 'generic_ci'],
    ['unknown', 'unknown'],
  ])(
    'retains explicit %s installation evidence',
    (environment, environmentEvidence) => {
      const batch = installFixture();
      const { ciProvider: _ciProvider, ...rest } = batch.events[0].properties;
      const event = {
        ...batch.events[0],
        properties: { ...rest, environment, environmentEvidence },
      };
      expect(
        parseCollectionBatch(
          'install',
          { schemaVersion: 1, events: [event] },
          now
        ).events[0].properties.environment
      ).toBe(environment);
    }
  );
  it.each([
    'runtime.session_started',
    'transport.connected',
    'runtime.first_stream_completed',
    'thread.persisted',
    'interrupt.handled',
    'generative_ui.rendered',
  ])('accepts the registered runtime kind %s', (kind) => {
    const event = {
      eventId: installFixture().events[0].eventId,
      kind,
      occurredAt: now.toISOString(),
      collectorVersion: '1',
      subject: {
        id: installFixture().events[0].subject.id,
        namespace: 'development_browser',
        scope: 'memory',
      },
      sessionId: '33333333-3333-4333-8333-333333333333',
      properties: {
        packageName: '@threadplane/langgraph',
        packageVersion: '1',
        integration: 'langgraph',
      },
    };
    expect(
      parseCollectionBatch(
        'runtime',
        { schemaVersion: 1, events: [event] },
        now
      ).events[0].kind
    ).toBe(kind);
  });
  it('rejects impossible calendar dates rather than normalizing them to another day', () => {
    const batch = installFixture();
    batch.events[0].occurredAt = '2026-09-31T12:00:00Z';
    expect(() =>
      parseCollectionBatch('install', batch, new Date('2026-10-01T12:00:00Z'))
    ).toThrow('invalid_payload');
  });
  it('normalizes install identity without authorizing a contact', () => {
    const batch = parseCollectionBatch('install', installFixture(), now);
    expect(batch.events[0].identity?.gitEmail).toBe(
      'developer@example.invalid'
    );
    expect(batch.events[0]).not.toHaveProperty('trust');
    expect(batch.events[0]).not.toHaveProperty('contactId');
  });

  it.each(['trust', 'accountId', 'approval', 'receivedAt', 'source'])(
    'rejects a forged %s field without echoing values',
    (key) => {
      const input = installFixture();
      Object.assign(input.events[0], { [key]: 'DO-NOT-LOG' });
      expect(() => parseCollectionBatch('install', input, now)).toThrow(
        'invalid_payload'
      );
    }
  );

  it.each([
    (b: ReturnType<typeof installFixture>) => {
      b.events[0].subject.namespace = 'development_browser';
    },
    (b: ReturnType<typeof installFixture>) => {
      b.events[0].properties.environment = 'local';
    },
    (b: ReturnType<typeof installFixture>) => {
      b.events[0].eventId = 'bad';
    },
    (b: ReturnType<typeof installFixture>) => {
      b.events[0].occurredAt = '2026-09-03T11:59:59Z';
    },
    (b: ReturnType<typeof installFixture>) => {
      b.events[0].occurredAt = '2026-09-04T12:05:01Z';
    },
    (b: ReturnType<typeof installFixture>) => {
      b.events[0].identity.gitDisplayName = 'x\nsecret';
    },
    (b: ReturnType<typeof installFixture>) => {
      Object.assign(b.events[0].properties, { cwd: '/private/path' });
    },
    (b: ReturnType<typeof installFixture>) => {
      b.events.push(b.events[0]);
    },
  ])('rejects invalid combinations and fields', (mutate) => {
    const batch = installFixture();
    mutate(batch);
    expect(() => parseCollectionBatch('install', batch, now)).toThrow(
      'invalid_payload'
    );
  });

  it('distinguishes unsupported versions and limits the batch', () => {
    expect(() =>
      parseCollectionBatch(
        'install',
        { ...installFixture(), schemaVersion: 2 },
        now
      )
    ).toThrow('unsupported_version');
    expect(() =>
      parseCollectionBatch('install', { schemaVersion: 1, events: [] }, now)
    ).toThrow('invalid_payload');
    const batch = installFixture();
    batch.events = Array(21).fill(batch.events[0]);
    expect(() => parseCollectionBatch('install', batch, now)).toThrow(
      'invalid_payload'
    );
  });

  it('accepts website topics but no identity or full URLs', () => {
    const event = {
      eventId: installFixture().events[0].eventId,
      occurredAt: now.toISOString(),
      collectorVersion: '1',
      subject: {
        id: installFixture().events[0].subject.id,
        namespace: 'website_session',
        scope: 'session',
      },
      kind: 'website.content_viewed',
      properties: { contentId: 'quickstart', topic: 'getting_started' },
    };
    expect(
      parseCollectionBatch(
        'website',
        { schemaVersion: 1, events: [event] },
        now
      ).events
    ).toHaveLength(1);
    expect(() =>
      parseCollectionBatch(
        'website',
        { schemaVersion: 1, events: [{ ...event, identity: {} }] },
        now
      )
    ).toThrow();
  });

  it('requires a runtime session and closed milestone properties', () => {
    const event = {
      eventId: installFixture().events[0].eventId,
      occurredAt: now.toISOString(),
      collectorVersion: '1',
      subject: {
        id: installFixture().events[0].subject.id,
        namespace: 'development_browser',
        scope: 'memory',
      },
      kind: 'runtime.first_stream_completed',
      sessionId: '33333333-3333-4333-8333-333333333333',
      properties: {
        packageName: '@threadplane/langgraph',
        packageVersion: '1',
        integration: 'langgraph',
        durationBucket: 'lt_1s',
      },
    };
    expect(
      parseCollectionBatch(
        'runtime',
        { schemaVersion: 1, events: [event] },
        now
      ).events
    ).toHaveLength(1);
    expect(() =>
      parseCollectionBatch(
        'runtime',
        { schemaVersion: 1, events: [{ ...event, sessionId: undefined }] },
        now
      )
    ).toThrow();
  });
});
