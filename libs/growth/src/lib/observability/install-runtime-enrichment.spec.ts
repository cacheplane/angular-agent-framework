import type { SqlExecutor } from '../database.ts';
import {
  enqueueInstallRuntimeEnrichment,
  readInstallRuntimeEnrichmentContext,
} from './install-runtime-enrichment.ts';

describe('install/runtime enrichment boundaries', () => {
  const now = new Date('2026-09-05T00:00:00Z');
  const input = {
    contactId: 'c',
    installObservationId: 'i',
    runtimeObservationId: 'r',
    email: 'developer@example.com',
    now,
  };
  it('does not enqueue personal-email research', async () => {
    const execute = vi.fn();
    await enqueueInstallRuntimeEnrichment(
      { execute },
      { ...input, email: 'a@gmail.com' }
    );
    expect(execute).not.toHaveBeenCalled();
  });
  it('keeps email/domain out of the persisted job payload', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    await enqueueInstallRuntimeEnrichment({ execute }, input);
    const params = execute.mock.calls[0][1];
    expect(params).toContain('install-runtime:v1:c:enrich');
    expect(params).not.toContain('developer@example.com');
    expect(params).not.toContain('example.com');
  });
  it('returns only the derived domain under a short privacy transaction', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ email_normalized: 'Developer@EXAMPLE.COM' }],
      });
    const db = {
      execute,
      transaction: async (fn: (tx: unknown) => unknown) => fn({ execute }),
    } as unknown as SqlExecutor;
    expect(
      await readInstallRuntimeEnrichmentContext(db, {
        jobId: 'j',
        leaseToken: 't',
        now,
      })
    ).toEqual({ companyDomain: 'example.com' });
    expect(execute.mock.calls[0][0]).toContain('pg_advisory_xact_lock_shared');
  });
});
