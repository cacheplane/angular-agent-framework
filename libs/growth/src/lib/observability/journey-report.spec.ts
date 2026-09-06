import { readContactJourney, readGrowthFunnel } from './journey-report.ts';
import type { SqlExecutor } from '../database.ts';

function executor(rows: Record<string, unknown>[][] = []) {
  const execute = vi.fn(async () => ({ rows: rows.shift() ?? [] }));
  return { execute, transaction: vi.fn() } as unknown as SqlExecutor;
}
describe('bounded journey reports', () => {
  it.each([
    [
      'https://example.invalid/about?email=person%40example.org#private',
      'https://example.invalid/about',
    ],
    ['https://example.invalid/person%40example.org', null],
    ['https://example.invalid/person%2540example.org', null],
    ['https://example.invalid/person@example.org', null],
    ['https://user:password@example.invalid/about', null],
    ['http://example.invalid/about', null],
    ['javascript:alert(1)', null],
    ['not a URL', null],
  ])(
    'removes identity and unsafe URL context from %s',
    async (url, expected) => {
      const id = '11111111-1111-4111-8111-111111111111';
      const db = executor([
        [{ id }],
        [
          {
            id,
            updated_at: '2026-01-01',
            deleted_at: null,
            outreach_approved_at: null,
            latest_hard_stop_kind: null,
            latest_hard_stop_at: null,
          },
        ],
        [],
        [],
        [],
        [],
        [{ sources: [{ id: 'source1', url }] }],
      ]);
      const result = await readContactJourney(db, id);
      expect(result.enrichment?.latest[0]).toMatchObject({
        sources: [{ id: 'source1', url: expected }],
      });
    }
  );
  it('validates range and identity before querying', async () => {
    const db = executor();
    await expect(
      readGrowthFunnel(db, {
        from: new Date('2026-01-01'),
        to: new Date('2026-03-01'),
      })
    ).rejects.toThrow();
    await expect(
      readContactJourney(db, 'email@example.invalid')
    ).rejects.toThrow();
    expect(db.execute).not.toHaveBeenCalled();
  });
  it('distinguishes missing contacts from empty evidence', async () => {
    expect(
      await readContactJourney(
        executor(),
        '11111111-1111-4111-8111-111111111111'
      )
    ).toMatchObject({ state: 'not_found' });
  });
  it('returns only control state for deleted contacts', async () => {
    const db = executor([
      [{ id: '11111111-1111-4111-8111-111111111111' }],
      [
        {
          id: '11111111-1111-4111-8111-111111111111',
          deleted_at: '2026-01-01',
          updated_at: '2026-01-01',
          outreach_approved_at: null,
          latest_hard_stop_kind: null,
          latest_hard_stop_at: null,
        },
      ],
    ]);
    const result = await readContactJourney(
      db,
      '11111111-1111-4111-8111-111111111111'
    );
    expect(result).toMatchObject({ state: 'redacted' });
    expect(db.execute).toHaveBeenCalledTimes(2);
  });
});
