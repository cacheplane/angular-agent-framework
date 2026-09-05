import { parseCollectionBatch } from './contracts.ts';
const now = new Date('2026-09-04T12:00:00.000Z');
function installFixture() {
  return {
    schemaVersion: 1,
    events: [
      {
        eventId: '11111111-1111-4111-8111-111111111111',
        kind: 'package.installed',
        occurredAt: now.toISOString(),
        collectorVersion: '1',
        subject: {
          id: '22222222-2222-4222-8222-222222222222',
          namespace: 'installation',
          scope: 'persistent',
        },
        properties: {
          packageName: '@threadplane/langgraph',
          packageVersion: '0.0.65',
          osFamily: 'linux',
          architecture: 'x64',
          nodeVersion: '22',
          environment: 'unknown',
          environmentEvidence: 'unknown',
        },
      },
    ],
  };
}

describe('installation correlation contract', () => {
  const token = '12345678-1234-4123-8123-123456789abc';
  it('retains an optional opaque token outside public properties', () => {
    const batch = installFixture();
    const event = { ...batch.events[0], installationToken: token };
    expect(
      parseCollectionBatch(
        'install',
        { schemaVersion: 1, events: [event] },
        now
      ).events[0]
    ).toMatchObject({ installationToken: token });
  });
  it.each(['email@example.invalid', '', null, '123'])(
    'rejects malformed token %s',
    (installationToken) => {
      const batch = installFixture();
      expect(() =>
        parseCollectionBatch(
          'install',
          {
            schemaVersion: 1,
            events: [{ ...batch.events[0], installationToken }],
          },
          now
        )
      ).toThrow('invalid_payload');
    }
  );
});
