import { randomUUID } from 'node:crypto';
import type { SqlExecutor } from '../src/lib/database.ts';
import { createEmailLookupCandidates } from '../src/lib/crypto.ts';
import { deleteContact } from '../src/lib/contacts.ts';
import { acceptObservationBatch } from '../src/lib/observability/ingest.ts';
import { replayObservations } from '../src/lib/observability/replay.ts';
import {
  leaseObservationWork,
  projectObservation,
} from '../src/lib/observability/projection.ts';
import {
  redactObservationEvidence,
  redactContactObservationEvidence,
  initializeObservationRedactions,
} from '../src/lib/observability/redaction.ts';
import {
  readTimeline,
  readObservationIdentity,
} from '../src/lib/observability/queries.ts';
import {
  cleanEvidence,
  evidenceDatabase,
  evidenceFixture,
  evidenceKeys,
} from './observability-fixtures.ts';

describe('private evidence redaction', () => {
  let db: SqlExecutor;
  const subjects: string[] = [];
  const operations: string[] = [];
  const emails: string[] = [];
  const contacts: string[] = [];
  beforeAll(async () => {
    db = await evidenceDatabase();
  });
  it('redacts every identity on one subject and fences their future installs', async () => {
    const now = new Date(),
      first = evidenceFixture(now),
      second = evidenceFixture(now);
    second.events[0].subject = first.events[0].subject;
    subjects.push(first.events[0].subject.id);
    for (const batch of [first, second]) {
      emails.push(batch.events[0].identity!.gitEmail!);
      await acceptObservationBatch(db, 'install', batch, {
        now,
        keyring: evidenceKeys,
      });
    }
    const id = (
      await db.execute<{ id: string }>(
        'select id from growth_observation_subjects where external_id=$1',
        [first.events[0].subject.id]
      )
    ).rows[0].id;
    const operationId = randomUUID();
    operations.push(operationId);
    expect(
      await redactObservationEvidence(
        db,
        { subjectId: id },
        { operationId, now, keyring: evidenceKeys }
      )
    ).toEqual({ selectedCount: 2 });
    expect(
      (
        await db.execute(
          'select i.observation_id from growth_observation_identities i join growth_observations o on o.id=i.observation_id where o.subject_id=$1',
          [id]
        )
      ).rows
    ).toHaveLength(0);
    for (const batch of [first, second]) {
      batch.events[0].eventId = randomUUID();
      batch.events[0].subject = {
        ...batch.events[0].subject,
        id: randomUUID(),
      };
      subjects.push(batch.events[0].subject.id);
      expect(
        (
          await acceptObservationBatch(db, 'install', batch, {
            now,
            keyring: evidenceKeys,
          })
        ).events[0].disposition
      ).toBe('redacted');
    }
  });
  it('initializes historical deleted-contact fences and aliases repeatably', async () => {
    const now = new Date(),
      batch = evidenceFixture(now),
      alias = evidenceFixture(now);
    subjects.push(batch.events[0].subject.id, alias.events[0].subject.id);
    const email = batch.events[0].identity!.gitEmail!,
      aliasEmail = alias.events[0].identity!.gitEmail!;
    emails.push(email, aliasEmail);
    const key = createEmailLookupCandidates(email, evidenceKeys)[0],
      aliasKey = createEmailLookupCandidates(aliasEmail, evidenceKeys)[0];
    const id = randomUUID();
    contacts.push(id);
    await db.execute(
      "insert into growth_contacts(id,email_normalized,email_lookup_hmac,email_hmac_key_version,source,deleted_at) values($1,null,$2,$3,'integration',$4)",
      [id, key.digest, key.keyVersion, now]
    );
    await db.execute(
      "insert into growth_activity(contact_id,kind,event_key,occurred_at,data) values($1,'contact.lookup_alias_added',$2,$3,$4::jsonb)",
      [
        id,
        `fixture:${randomUUID()}`,
        now,
        JSON.stringify({
          digest: aliasKey.digest,
          key_version: aliasKey.keyVersion,
        }),
      ]
    );
    await expect(
      acceptObservationBatch(db, 'install', batch, {
        now,
        keyring: evidenceKeys,
      })
    ).rejects.toThrow('redaction_initialization_required');
    for (let pass = 0; pass < 2; pass++) {
      let cursor: string | undefined;
      do {
        const result = await initializeObservationRedactions(
          db,
          { limit: 100, cursor },
          now
        );
        cursor = result.nextCursor ?? undefined;
      } while (cursor);
    }
    for (const fixture of [batch, alias])
      expect(
        (
          await acceptObservationBatch(db, 'install', fixture, {
            now,
            keyring: evidenceKeys,
          })
        ).events[0].disposition
      ).toBe('redacted');
  });
  it('rejects operation IDs belonging to replay before interpreting private digests', async () => {
    const now = new Date(),
      operationId = randomUUID();
    operations.push(operationId);
    await replayObservations(
      db,
      { operationId, subjectId: randomUUID(), maxEvents: 1 },
      now
    );
    await expect(
      redactObservationEvidence(
        db,
        { email: 'synthetic@example.invalid' },
        { operationId, now, keyring: evidenceKeys }
      )
    ).rejects.toThrow('operation_conflict');
  });
  it('fences leased work and retained keys while leaving another identity untouched', async () => {
    const now = new Date(),
      batch = evidenceFixture(now),
      other = evidenceFixture(now);
    subjects.push(batch.events[0].subject.id, other.events[0].subject.id);
    const email = batch.events[0].identity!.gitEmail!;
    emails.push(email);
    for (const fixture of [batch, other])
      await acceptObservationBatch(db, 'install', fixture, {
        now,
        keyring: evidenceKeys,
      });
    const rows = (
      await db.execute<{ id: string; event_id: string }>(
        'select id,event_id from growth_observations where event_id=any($1::uuid[])',
        [[batch.events[0].eventId, other.events[0].eventId]]
      )
    ).rows;
    const id = rows.find((r) => r.event_id === batch.events[0].eventId)!.id;
    const otherId = rows.find(
      (r) => r.event_id === other.events[0].eventId
    )!.id;
    const lease = (await leaseObservationWork(db, { now, limit: 20 })).find(
      (l) => l.observationId === id
    )!;
    const operationId = randomUUID();
    operations.push(operationId);
    await redactObservationEvidence(
      db,
      { email },
      { operationId, now, keyring: evidenceKeys }
    );
    expect(await projectObservation(db, lease, { now: () => now })).toBe(
      'lease_lost'
    );
    expect(await readObservationIdentity(db, id)).toBeNull();
    expect((await readObservationIdentity(db, otherId))?.email_normalized).toBe(
      other.events[0].identity!.gitEmail
    );
    const rotated = {
      active: {
        version: 778,
        secret: 'rotated-fixture-secret-at-least-32-bytes',
      },
      previous: [evidenceKeys.active],
    };
    batch.events[0].eventId = randomUUID();
    expect(
      (
        await acceptObservationBatch(db, 'install', batch, {
          now,
          keyring: rotated,
        })
      ).events[0].disposition
    ).toBe('redacted');
    await expect(
      acceptObservationBatch(db, 'install', batch, {
        now,
        keyring: { active: rotated.active },
      })
    ).rejects.toThrow('identity_key_unavailable');
  });
  afterAll(async () => {
    await cleanEvidence(db, subjects, operations);
    for (const email of emails)
      for (const key of createEmailLookupCandidates(email, evidenceKeys))
        await db.execute(
          `delete from growth_observation_redactions where selector_kind='email' and selector_key=$1 and key_version=$2`,
          [key.digest, key.keyVersion]
        );
    await db.execute(
      'delete from growth_activity where contact_id=any($1::uuid[])',
      [contacts]
    );
    await db.execute('delete from growth_contacts where id=any($1::uuid[])', [
      contacts,
    ]);
    await db.close?.();
  });
  it('redacts an install-only identity and never restores it on new events or retries', async () => {
    const now = new Date();
    const batch = evidenceFixture(now);
    subjects.push(batch.events[0].subject.id);
    const email = batch.events[0].identity!.gitEmail!;
    emails.push(email);
    await acceptObservationBatch(db, 'install', batch, {
      now,
      keyring: evidenceKeys,
    });
    const row = (
      await db.execute<{ id: string; subject_id: string }>(
        'select id,subject_id from growth_observations where event_id=$1',
        [batch.events[0].eventId]
      )
    ).rows[0];
    expect(
      JSON.stringify(await readTimeline(db, row.subject_id))
    ).not.toContain(email);
    expect((await readObservationIdentity(db, row.id))?.email_normalized).toBe(
      email
    );
    const operationId = randomUUID();
    operations.push(operationId);
    await redactObservationEvidence(
      db,
      { email },
      { operationId, now, keyring: evidenceKeys }
    );
    expect(await readObservationIdentity(db, row.id)).toBeNull();
    expect(
      (
        await acceptObservationBatch(db, 'install', batch, {
          now,
          keyring: evidenceKeys,
        })
      ).events[0].disposition
    ).toBe('redacted');
    batch.events[0].eventId = randomUUID();
    expect(
      (
        await acceptObservationBatch(db, 'install', batch, {
          now,
          keyring: evidenceKeys,
        })
      ).events[0].disposition
    ).toBe('redacted');
    const count = await db.execute(
      'select i.observation_id from growth_observation_identities i join growth_observations o on o.id=i.observation_id where o.subject_id=$1',
      [row.subject_id]
    );
    expect(count.rows).toEqual([]);
  });
  it('fences a contact before its first observation exists', async () => {
    const now = new Date();
    const batch = evidenceFixture(now);
    subjects.push(batch.events[0].subject.id);
    const email = batch.events[0].identity!.gitEmail!;
    emails.push(email);
    const key = createEmailLookupCandidates(email, evidenceKeys)[0];
    const id = randomUUID();
    contacts.push(id);
    await db.execute(
      `insert into growth_contacts(id,email_normalized,email_lookup_hmac,email_hmac_key_version,source) values($1,$2,$3,$4,'integration')`,
      [id, email, key.digest, key.keyVersion]
    );
    await db.transaction(async (tx) => {
      await tx.execute(
        'select id from growth_contacts where id=$1 for update',
        [id]
      );
      await redactContactObservationEvidence(tx, id, now);
      await tx.execute(
        'update growth_contacts set email_normalized=null,deleted_at=$2 where id=$1',
        [id, now]
      );
    });
    expect(
      (
        await acceptObservationBatch(db, 'install', batch, {
          now,
          keyring: evidenceKeys,
        })
      ).events[0].disposition
    ).toBe('redacted');
  });
  it('extends the canonical contact deletion transaction', async () => {
    const now = new Date();
    const batch = evidenceFixture(now);
    subjects.push(batch.events[0].subject.id);
    const email = batch.events[0].identity!.gitEmail!;
    emails.push(email);
    const key = createEmailLookupCandidates(email, evidenceKeys)[0];
    const id = randomUUID();
    contacts.push(id);
    await db.execute(
      `insert into growth_contacts(id,email_normalized,email_lookup_hmac,email_hmac_key_version,source) values($1,$2,$3,$4,'integration')`,
      [id, email, key.digest, key.keyVersion]
    );
    await deleteContact(db, {
      contactId: id,
      eventKey: `integration:delete:${randomUUID()}`,
      occurredAt: now,
      actor: 'test',
      source: 'integration',
      policyVersion: 'growth-v1',
    });
    expect(
      (
        await acceptObservationBatch(db, 'install', batch, {
          now,
          keyring: evidenceKeys,
        })
      ).events[0].disposition
    ).toBe('redacted');
  });
});
