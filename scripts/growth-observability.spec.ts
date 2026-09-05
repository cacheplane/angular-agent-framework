import { runGrowthObservability } from './growth-observability.mts';

function dependencies() {
  return {
    createDatabase: vi.fn(() => {
      throw new Error('must not connect');
    }),
    loadKeyring: vi.fn(() => ({
      active: { version: 1, secret: 'x'.repeat(32) },
    })),
    environment: () => ({}),
    now: () => new Date('2026-09-04T12:00:00Z'),
    readEmail: vi.fn(async () => ''),
    writeOutput: vi.fn(),
    writeError: vi.fn(),
  };
}
describe('observation operator boundary', () => {
  it('allows redacted reads with processing disabled and closes the executor', async () => {
    const execute = vi.fn(async () => ({ rows: [] })),
      close = vi.fn(async () => undefined);
    const deps = {
      ...dependencies(),
      createDatabase: vi.fn(() => ({ execute, close, transaction: vi.fn() })),
    };
    expect(
      await runGrowthObservability(
        [
          'health',
          '--from',
          '2026-09-04T00:00:00Z',
          '--to',
          '2026-09-05T00:00:00Z',
        ],
        deps
      )
    ).toBe(0);
    expect(close).toHaveBeenCalledOnce();
    expect(deps.loadKeyring).not.toHaveBeenCalled();
    expect(deps.writeOutput).toHaveBeenCalledWith(
      expect.stringContaining('currentQueue')
    );
  });
  it('closes after a query failure and returns only a safe error', async () => {
    const execute = vi.fn(async () => {
        throw new Error('private@example.invalid');
      }),
      close = vi.fn(async () => undefined);
    const deps = {
      ...dependencies(),
      createDatabase: vi.fn(() => ({ execute, close, transaction: vi.fn() })),
    };
    expect(
      await runGrowthObservability(
        ['timeline', '--subject', '11111111-1111-4111-8111-111111111111'],
        deps
      )
    ).toBe(1);
    expect(close).toHaveBeenCalledOnce();
    expect(deps.writeError).toHaveBeenCalledWith('operation_failed');
    expect(deps.writeOutput).not.toHaveBeenCalled();
  });
  it.each([
    ['detail', '--observation', '11111111-1111-4111-8111-111111111111'],
    ['redact', '--email', 'private@example.invalid'],
    ['timeline', '--subject', 'invalid'],
    ['process', '--limit', '100000'],
    ['replay', '--subject', '11111111-1111-4111-8111-111111111111'],
  ])(
    'rejects invalid command arguments before database access: %s',
    async (...args) => {
      const deps = dependencies();
      expect(await runGrowthObservability(args, deps)).toBe(2);
      expect(deps.createDatabase).not.toHaveBeenCalled();
      expect(JSON.stringify(deps.writeError.mock.calls)).not.toContain(
        'private@example.invalid'
      );
    }
  );
  it.each(['process', 'project-forms'])(
    'does not run %s when the independent switch is off',
    async (command) => {
      const deps = dependencies();
      expect(
        await runGrowthObservability([command, '--limit', '10'], deps)
      ).toBe(0);
      expect(deps.createDatabase).not.toHaveBeenCalled();
      expect(deps.writeOutput).toHaveBeenCalledWith(
        expect.stringContaining('disabled')
      );
    }
  );
  it('does not echo connection exceptions', async () => {
    const deps = dependencies();
    expect(
      await runGrowthObservability(
        [
          'health',
          '--from',
          '2026-09-04T00:00:00Z',
          '--to',
          '2026-09-05T00:00:00Z',
        ],
        deps
      )
    ).toBe(1);
    expect(deps.writeError).toHaveBeenCalledWith('operation_failed');
  });
});
