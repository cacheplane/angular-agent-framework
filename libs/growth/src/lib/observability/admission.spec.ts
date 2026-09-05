import { consumeSourceBudget, consumeSubjectBudgets } from './admission.ts';
import type { SqlExecutor } from '../database.ts';

describe('collection admission', () => {
  it('fails closed when storage fails', async () => {
    const db = {
      transaction: async () => {
        throw new Error('secret');
      },
    } as unknown as SqlExecutor;
    await expect(
      consumeSourceBudget(db, 'install', new Date())
    ).rejects.toThrow('admission_unavailable');
  });
  it('rejects unbounded subject batches before accessing storage', async () => {
    const db = { transaction: vi.fn() } as unknown as SqlExecutor;
    await expect(
      consumeSubjectBudgets(
        db,
        'install',
        Array(21).fill({ subject: { id: 'x', namespace: 'installation' } }),
        new Date()
      )
    ).rejects.toThrow();
    expect(db.transaction).not.toHaveBeenCalled();
  });
});
