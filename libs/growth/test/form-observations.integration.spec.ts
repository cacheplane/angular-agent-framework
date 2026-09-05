import { randomUUID } from 'node:crypto';
import type { SqlExecutor } from '../src/lib/database.ts';
import { acceptFormSubmission } from '../src/lib/forms.ts';
import { deleteContact } from '../src/lib/contacts.ts';
import { projectFormObservations } from '../src/lib/observability/form-projection.ts';
import { acceptObservationBatch } from '../src/lib/observability/ingest.ts';
import { redactObservationEvidence } from '../src/lib/observability/redaction.ts';
import { processObservations } from '../src/lib/observability/projection.ts';
import { readObservationIdentity } from '../src/lib/observability/queries.ts';
import { replayObservations } from '../src/lib/observability/replay.ts';
import {
  cleanEvidence,
  cleanContactObservationFences,
  evidenceDatabase,
  evidenceKeys,
} from './observability-fixtures.ts';

describe('recoverable server form observations', () => {
  let db: SqlExecutor;
  const subjects: string[] = [],
    contacts: string[] = [],
    operations: string[] = [];
  beforeAll(async () => {
    db = await evidenceDatabase();
  });
  afterAll(async () => {
    await cleanEvidence(db, subjects, operations);
    for (const id of contacts) {
      await cleanContactObservationFences(db, id);
      await db.execute('delete from growth_activity where contact_id=$1', [id]);
      await db.execute('delete from growth_jobs where contact_id=$1', [id]);
      await db.execute('delete from growth_contacts where id=$1', [id]);
    }
    await db.close?.();
  });
  async function form(session: string | undefined = randomUUID()) {
    const submissionId = randomUUID(),
      email = `${randomUUID()}@example.invalid`,
      now = new Date();
    subjects.push(session || submissionId);
    const result = await acceptFormSubmission(db, {
      submissionId,
      email,
      form: { kind: 'contact', message: 'DO-NOT-PROJECT' },
      source: 'integration',
      sourceForm: 'contact',
      noticeText: 'Synthetic notice',
      noticeVersion: 'test',
      policyVersion: 'test',
      acquisitionSessionId: session,
      occurredAt: now,
      keyring: evidenceKeys,
    });
    contacts.push(result.contactId);
    return { ...result, session, email, now };
  }
  it('recovers after a transaction crash and projects concurrent retries exactly once', async () => {
    const accepted = await form();
    const jobs = (
      await db.execute('select id from growth_jobs where contact_id=$1', [
        accepted.contactId,
      ])
    ).rows;
    const crashing: SqlExecutor = {
      execute: db.execute.bind(db),
      transaction: (operation) =>
        db.transaction(async (tx) => {
          await operation(tx);
          throw new Error('synthetic crash');
        }),
    };
    await expect(
      projectFormObservations(crashing, { enabled: true, limit: 10 })
    ).rejects.toThrow('synthetic crash');
    expect(
      (
        await db.execute(
          "select id from growth_observations where source='form' and event_id=$1",
          [accepted.submissionId]
        )
      ).rows
    ).toHaveLength(0);
    const results = await Promise.all(
      [1, 2].map(() =>
        projectFormObservations(db, { enabled: true, limit: 10 })
      )
    );
    expect(results.reduce((sum, result) => sum + result.projected, 0)).toBe(1);
    const rows = (
      await db.execute(
        "select o.id,o.trust,o.properties,s.namespace,s.external_id from growth_observations o join growth_observation_subjects s on s.id=o.subject_id where o.source='form' and o.event_id=$1",
        [accepted.submissionId]
      )
    ).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      trust: 'server_verified',
      properties: { formKind: 'contact' },
      namespace: 'website_session',
      external_id: accepted.session,
    });
    expect(JSON.stringify(rows)).not.toMatch(/DO-NOT-PROJECT|notice|email/);
    expect(
      (
        await db.execute('select id from growth_jobs where contact_id=$1', [
          accepted.contactId,
        ])
      ).rows
    ).toEqual(jobs);
    expect(
      (await projectFormObservations(db, { enabled: true, limit: 10 }))
        .projected
    ).toBe(0);
  });
  it('never accepts public form provenance and gives unlinked submissions a separate subject', async () => {
    const accepted = await form('');
    await projectFormObservations(db, { enabled: true, limit: 10 });
    const row = (
      await db.execute(
        "select s.namespace,s.external_id from growth_observations o join growth_observation_subjects s on s.id=o.subject_id where o.source='form' and o.event_id=$1",
        [accepted.submissionId]
      )
    ).rows[0];
    expect(row).toEqual({
      namespace: 'form_submission',
      external_id: accepted.submissionId,
    });
    subjects.push(accepted.submissionId);
    await expect(
      acceptObservationBatch(db, 'form' as never, {}, { now: new Date() })
    ).rejects.toThrow('invalid_payload');
  });
  it('respects redaction before projection without changing contact approval', async () => {
    const accepted = await form(),
      operationId = randomUUID();
    operations.push(operationId);
    const approval = (
      await db.execute(
        'select outreach_approved_at from growth_contacts where id=$1',
        [accepted.contactId]
      )
    ).rows;
    await redactObservationEvidence(
      db,
      { email: accepted.email },
      { operationId, now: new Date(), keyring: evidenceKeys }
    );
    await projectFormObservations(db, { enabled: true, limit: 10 });
    expect(
      (
        await db.execute(
          'select observation_id from growth_observation_form_links where contact_id=$1',
          [accepted.contactId]
        )
      ).rows
    ).toHaveLength(0);
    expect(
      (
        await db.execute(
          'select outreach_approved_at from growth_contacts where id=$1',
          [accepted.contactId]
        )
      ).rows
    ).toEqual(approval);
  });
  it('erases form links on subject redaction and never restores them through replay', async () => {
    const accepted = await form();
    await projectFormObservations(db, { enabled: true, limit: 10 });
    const row = (
      await db.execute<{ id: string; subject_id: string }>(
        "select id,subject_id from growth_observations where source='form' and event_id=$1",
        [accepted.submissionId]
      )
    ).rows[0];
    const operationId = randomUUID(),
      replayId = randomUUID();
    expect(await readObservationIdentity(db, row.id)).toMatchObject({
      email_normalized: accepted.email,
      provenance: 'form_submission',
    });
    operations.push(operationId, replayId);
    await redactObservationEvidence(
      db,
      { subjectId: row.subject_id },
      { operationId, now: new Date(), keyring: evidenceKeys }
    );
    await replayObservations(db, {
      operationId: replayId,
      subjectId: row.subject_id,
      maxEvents: 10,
    });
    await processObservations(db, { enabled: true, limit: 100 });
    await projectFormObservations(db, { enabled: true, limit: 10 });
    expect(await readObservationIdentity(db, row.id)).toBeNull();
    expect(
      (
        await db.execute(
          'select observation_id from growth_observation_form_links where observation_id=$1',
          [row.id]
        )
      ).rows
    ).toHaveLength(0);
  });
  it('serializes contact deletion with projection without retaining a contact link', async () => {
    const accepted = await form();
    await Promise.all([
      projectFormObservations(db, { enabled: true, limit: 10 }),
      deleteContact(db, {
        contactId: accepted.contactId,
        eventKey: `delete:${randomUUID()}`,
        occurredAt: new Date(),
        actor: 'test',
        source: 'integration',
        policyVersion: 'test',
      }),
    ]);
    await projectFormObservations(db, { enabled: true, limit: 10 });
    expect(
      (
        await db.execute(
          'select observation_id from growth_observation_form_links where contact_id=$1',
          [accepted.contactId]
        )
      ).rows
    ).toHaveLength(0);
  });
});
