import { describe, it, expect } from 'vitest';
import type { SqlExecutor, SqlTransaction } from './database.ts';
import { persistJobArtifact } from './jobs.ts';
import {
  beginResearchAttempt,
  acknowledgeResearchRun,
  publishResearchArtifact,
  getResearchAttempt,
  markResearchSubmissionStarted,
  getResearchInput,
  readResearchCompanyDomain,
  recordResearchCleanupQuiescence,
} from './research-jobs.ts';

const now = new Date('2026-09-05T00:00:00Z');
const input = {
  jobId: 'job',
  leaseToken: 'lease',
  now,
  attemptId: 'attempt',
  threadId: 'thread',
  companyDomain: 'example.com',
  evidenceHash: 'a'.repeat(64),
  expiresAt: new Date(now.getTime() + 90000),
  researchInput: {
    version: 'company_research.request.v1',
    attemptId: 'attempt',
    domain: 'example.com',
    pages: [],
    evidenceHash: 'a'.repeat(64),
    expiresAt: new Date(now.getTime() + 90000).toISOString(),
    generationRef: 'generation',
  },
};
function fixture(existing?: Record<string, unknown>, authorized = true) {
  const calls: { sql: string; parameters: readonly unknown[] }[] = [];
  const tx: SqlTransaction = {
    async execute(sql, parameters = []) {
      calls.push({ sql, parameters });
      let rows: Record<string, unknown>[] = [];
      if (sql.includes('research-discover')) rows = [{ contact_id: 'contact' }];
      if (sql.includes('research-lock-contact')) rows = [{ id: 'contact' }];
      if (sql.includes('research-authorize') && authorized)
        rows = [
          {
            payload: existing
              ? {
                  research_attempt: existing,
                  research_input: input.researchInput,
                }
              : {},
            company_domain: 'example.com',
            email_normalized: 'a@example.com',
          },
        ];
      if (sql.includes('research-insert-artifact')) rows = [{ id: 'artifact' }];
      if (sql.includes('research-cleanup-proof') && authorized)
        rows = [{ id: 'cleanup' }];
      return { rows } as never;
    },
  };
  const db: SqlExecutor = { ...tx, transaction: (operation) => operation(tx) };
  return { db, calls };
}
describe('durable research attempts', () => {
  it('records immutable cleanup proof under cleanup lease and exact opaque identity', async () => {
    const { db, calls } = fixture();
    await recordResearchCleanupQuiescence(db, {
      ...input,
      runId: 'run',
      settledAt: now.toISOString(),
    });
    expect(calls[0].sql).toContain("kind='research_cleanup'");
    expect(calls[0].sql).toContain('lease_until>$3');
    expect(calls[0].sql).toContain('cleanup_quiescence');
    await expect(
      recordResearchCleanupQuiescence(fixture(undefined, false).db, {
        ...input,
        runId: 'run',
        settledAt: now.toISOString(),
      })
    ).rejects.toThrow('lease');
  });
  it('returns only an authorized candidate company domain before capture', async () => {
    expect(await readResearchCompanyDomain(fixture().db, input)).toBe(
      'example.com'
    );
    await expect(
      readResearchCompanyDomain(fixture(undefined, false).db, input)
    ).rejects.toThrow('lease');
  });
  it('persists the bounded wire snapshot with attempt creation and never recaptures on recovery', async () => {
    const { db, calls } = fixture();
    const result = await beginResearchAttempt(db, input);
    expect(result.researchInput).toEqual(input.researchInput);
    const write = calls.find((c) => c.sql.includes('research-record-attempt'));
    expect(write?.sql).toContain('research_input');
    expect(write?.parameters).toContain(JSON.stringify(input.researchInput));
    expect(
      getResearchInput({
        payload: {
          research_attempt: result.attempt,
          research_input: input.researchInput,
        },
      })
    ).toEqual(input.researchInput);
  });
  it('rejects extra identity fields and changed snapshot correlation before persistence', async () => {
    for (const researchInput of [
      { ...input.researchInput, email: 'person@example.com' },
      { ...input.researchInput, evidenceHash: 'b'.repeat(64) },
      { ...input.researchInput, pages: [{ rawBody: 'secret' }] },
    ]) {
      const { db, calls } = fixture();
      await expect(
        beginResearchAttempt(db, { ...input, researchInput })
      ).rejects.toThrow();
      expect(
        calls.some((c) => c.sql.includes('research-enqueue-cleanup'))
      ).toBe(false);
    }
  });
  it('requires the attempt publication guard for the new artifact kind', async () => {
    const { db, calls } = fixture();
    await expect(
      persistJobArtifact(db, {
        jobId: 'job',
        kind: 'company_enrichment.v1',
        schemaVersion: 1,
        content: {},
      })
    ).rejects.toThrow('publishResearchArtifact');
    expect(calls).toHaveLength(0);
  });
  it('records acknowledged run identity in parent and independent cleanup', async () => {
    const { db, calls } = fixture({
      ...input,
      expiresAt: input.expiresAt.toISOString(),
      runId: null,
      phase: 'submitting',
    });
    await acknowledgeResearchRun(db, { ...input, runId: 'run' });
    expect(calls.some((c) => c.sql.includes('research-acknowledge'))).toBe(
      true
    );
    const cleanup = calls.find((c) =>
      c.sql.includes('research-cleanup-acknowledge')
    );
    if (!cleanup) throw new Error('Missing cleanup acknowledgement');
    expect(cleanup.parameters).toEqual(['research-cleanup:v1:attempt', 'run']);
  });
  it('publishes only the acknowledged matching attempt with an idempotent result comparison', async () => {
    const { db, calls } = fixture({
      ...input,
      expiresAt: input.expiresAt.toISOString(),
      runId: 'run',
      phase: 'submitted',
    });
    await publishResearchArtifact(db, {
      ...input,
      content: { profile: { name: 'Example' } },
    });
    const insert = calls.find((c) =>
      c.sql.includes('research-insert-artifact')
    );
    if (!insert) throw new Error('Missing artifact insertion');
    expect(insert.sql).toContain('growth_artifacts.content=excluded.content');
  });
  it('creates independent cleanup before recording an immutable attempt under ordered locks', async () => {
    const { db, calls } = fixture();
    expect((await beginResearchAttempt(db, input)).created).toBe(true);
    const sql = calls.map((c) => c.sql).join('\n');
    expect(sql.indexOf('privacy')).toBeLessThan(
      sql.indexOf('research-lock-contact')
    );
    expect(sql.indexOf('research-lock-contact')).toBeLessThan(
      sql.indexOf('research-authorize')
    );
    expect(sql.indexOf('research-enqueue-cleanup')).toBeLessThan(
      sql.indexOf('research-record-attempt')
    );
    const cleanup = calls.find((c) =>
      c.sql.includes('research-enqueue-cleanup')
    );
    if (!cleanup) throw new Error('Missing cleanup insertion');
    expect(cleanup.sql).toContain('null, null');
    expect(JSON.stringify(cleanup.parameters)).not.toContain('example.com');
    expect(sql).toContain('growth_install_runtime_links');
    expect(sql).toContain('outreach_approved_at');
  });
  it('returns the original ambiguous attempt even after expiry without another submission authorization', async () => {
    const attempt = {
      ...input,
      expiresAt: input.expiresAt.toISOString(),
      runId: null,
      phase: 'submitting',
    };
    const { db, calls } = fixture(attempt);
    const result = await beginResearchAttempt(db, {
      ...input,
      attemptId: 'other',
      now: new Date(now.getTime() + 100000),
    });
    expect(result.created).toBe(false);
    expect(result.attempt.attemptId).toBe('attempt');
    expect(calls.some((c) => c.sql.includes('research-enqueue-cleanup'))).toBe(
      false
    );
  });
  it('rejects missing eligibility before creating remote cleanup or publishing', async () => {
    const { db, calls } = fixture(undefined, false);
    await expect(beginResearchAttempt(db, input)).rejects.toThrow('lease');
    await expect(
      publishResearchArtifact(db, { ...input, content: {} })
    ).rejects.toThrow('lease');
    expect(calls.some((c) => c.sql.includes('research-insert-artifact'))).toBe(
      false
    );
  });
  it('rejects a changed company or superseded attempt before publication', async () => {
    const { db } = fixture({
      ...input,
      expiresAt: input.expiresAt.toISOString(),
      runId: 'run',
      phase: 'submitted',
    });
    await expect(
      publishResearchArtifact(db, {
        ...input,
        companyDomain: 'changed.com',
        content: {},
      })
    ).rejects.toThrow();
    await expect(
      acknowledgeResearchRun(db, { ...input, attemptId: 'other', runId: 'run' })
    ).rejects.toThrow();
  });
  it('does not reinterpret malformed persisted metadata as permission for a new run', () => {
    expect(() =>
      getResearchAttempt({
        payload: { research_attempt: { attemptId: 'bad' } },
      })
    ).toThrow();
  });
  it('claims prepared submission once and never reclaims an ambiguous submission', async () => {
    for (const phase of ['prepared', 'submitting', 'submitted']) {
      const { db, calls } = fixture({
        ...input,
        expiresAt: input.expiresAt.toISOString(),
        runId: null,
        phase,
      });
      expect(await markResearchSubmissionStarted(db, input)).toEqual({
        claimed: phase === 'prepared',
      });
      expect(calls.some((c) => c.sql.includes('research-submit-fence'))).toBe(
        phase === 'prepared'
      );
    }
  });
});
