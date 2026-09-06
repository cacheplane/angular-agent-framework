import { randomUUID } from 'node:crypto';
import type { SqlExecutor } from '../src/lib/database.ts';
import {
  readContactJourney,
  readGrowthFunnel,
} from '../src/lib/observability/journey-report.ts';
import { acceptObservationBatch } from '../src/lib/observability/ingest.ts';
import {
  cleanEvidence,
  evidenceDatabase,
  evidenceFixture,
  evidenceKeys,
} from './observability-fixtures.ts';

describe('operator journey SQL joins and privacy', () => {
  let db: SqlExecutor;
  const contactId = randomUUID(),
    otherContact = randomUUID(),
    jobId = randomUUID();
  const subjects: string[] = [];
  const now = new Date('2026-08-02T12:00:00Z');
  beforeAll(async () => {
    db = await evidenceDatabase();
  });
  afterAll(async () => {
    await db.execute(
      'delete from growth_artifacts where contact_id=any($1::uuid[])',
      [[contactId, otherContact]]
    );
    await cleanEvidence(db, subjects);
    await db.execute(
      'delete from growth_jobs where contact_id=any($1::uuid[])',
      [[contactId, otherContact]]
    );
    await db.execute(
      'delete from growth_activity where contact_id=any($1::uuid[])',
      [[contactId, otherContact]]
    );
    await db.execute('delete from growth_contacts where id=any($1::uuid[])', [
      [contactId, otherContact],
    ]);
    await db.close?.();
  });
  it('deduplicates linked contacts, excludes unrelated outcomes, bounds evidence and redacts deleted profiles', async () => {
    for (const id of [contactId, otherContact]) {
      await db.execute(
        `insert into growth_contacts(id,email_normalized,email_lookup_hmac,email_hmac_key_version,source,outreach_approved_at)
        values($1,$2,$3,777,'test',$4)`,
        [id, `${id}@private.invalid`, randomUUID(), now]
      );
    }
    const batch = evidenceFixture(now);
    subjects.push(batch.events[0].subject.id);
    await acceptObservationBatch(db, 'install', batch, {
      now,
      keyring: evidenceKeys,
    });
    const installId = (
      await db.execute<{ id: string }>(
        'select id from growth_observations where event_id=$1',
        [batch.events[0].eventId]
      )
    ).rows[0].id;
    // Two separately collected runtime observations link to the same admitted installation/contact.
    const runtimeSubject = randomUUID();
    subjects.push(runtimeSubject);
    const events = [1, 2].map(() => ({
      eventId: randomUUID(),
      sessionId: randomUUID(),
      kind: 'runtime.session_started',
      occurredAt: now.toISOString(),
      collectorVersion: '1',
      subject: {
        id: runtimeSubject,
        namespace: 'development_browser',
        scope: 'memory',
      },
      properties: {
        packageName: '@threadplane/langgraph',
        packageVersion: '1',
        integration: 'langgraph',
      },
    }));
    await acceptObservationBatch(
      db,
      'runtime',
      { schemaVersion: 1, events },
      { now }
    );
    for (const event of events)
      await db.execute(
        `insert into growth_install_runtime_links(runtime_observation_id,install_observation_id,contact_id,outcome,evaluated_at)
      select id,$2,$3,'approved',$4 from growth_observations where event_id=$1`,
        [event.eventId, installId, contactId, now]
      );
    for (const [id, kind] of [
      [contactId, 'campaign.enrolled:v1'],
      [otherContact, 'campaign.reply_received'],
    ]) {
      await db.execute(
        'insert into growth_activity(event_key,contact_id,kind,occurred_at,data) values($1,$2,$3,$4,$5::jsonb)',
        [
          randomUUID(),
          id,
          kind,
          now,
          JSON.stringify({ email: 'hidden@private.invalid' }),
        ]
      );
    }
    await db.execute(
      `insert into growth_jobs(id,kind,contact_id,status,available_at,idempotency_key,payload) values($1,'enrich',$2,'completed',$3,$4,$5::jsonb)`,
      [
        jobId,
        contactId,
        now,
        randomUUID(),
        JSON.stringify({
          source: 'install_runtime',
          install_observation_id: installId,
          email: 'hidden@private.invalid',
        }),
      ]
    );
    await db.execute(
      `insert into growth_artifacts(job_id,contact_id,kind,schema_version,content) values($1,$2,'enrichment.v1',1,$3::jsonb)`,
      [
        jobId,
        contactId,
        JSON.stringify({
          company_profile: {
            name: 'Example',
            description: 'A company',
            industry: 'Software',
          },
          sources: [
            {
              id: 'source1',
              url: 'https://example.invalid/about',
              retrieved_at: now.toISOString(),
              content_hash: 'a'.repeat(64),
            },
          ],
          summary: 'hidden@private.invalid',
          drafts: ['private content'],
        }),
      ]
    );
    for (const [kind, schemaVersion] of [
      ['unrelated', 1],
      ['enrichment.v1', 2],
    ] as const) {
      await db.execute(
        'update growth_artifacts set kind=$2,schema_version=$3 where job_id=$1',
        [jobId, kind, schemaVersion]
      );
      const excluded = await readGrowthFunnel(db, {
        from: new Date('2026-08-02'),
        to: new Date('2026-08-03'),
      });
      expect(excluded.linkedContactCohort.counts).toMatchObject({
        enriched_contacts: '0',
      });
      expect((await readContactJourney(db, contactId)).enrichment?.state).toBe(
        'no_evidence'
      );
    }
    await db.execute(
      "update growth_artifacts set kind='enrichment.v1',schema_version=1 where job_id=$1",
      [jobId]
    );
    const funnel = await readGrowthFunnel(db, {
      from: new Date('2026-08-02'),
      to: new Date('2026-08-03'),
    });
    expect(funnel.linkedContactCohort.counts).toMatchObject({
      linked_contacts: '1',
      enrolled_contacts: '1',
      replied_contacts: '0',
      enriched_contacts: '1',
    });
    expect(funnel.activationDecisions.rows).toContainEqual({
      outcome: 'approved',
      runtime_observations: '2',
      contacts: '1',
    });
    const journey = await readContactJourney(db, contactId);
    expect(journey.observations?.latest).toHaveLength(3);
    expect(journey.enrichment?.latest[0]).toMatchObject({
      company_name: 'Example',
      sources: [
        {
          id: 'source1',
          url: 'https://example.invalid/about',
          retrieved_at: now.toISOString(),
          content_hash: 'a'.repeat(64),
        },
      ],
    });
    expect(JSON.stringify(journey)).not.toMatch(
      /private.invalid|private content|Synthetic Developer/
    );
    await db.execute(
      `insert into growth_activity(event_key,contact_id,kind,occurred_at)
      select $1 || n,$2,'test.event',$3 from generate_series(1,55) n`,
      [randomUUID(), contactId, now]
    );
    const truncated = await readContactJourney(db, contactId);
    expect(truncated.activity?.latest).toHaveLength(50);
    expect(truncated.activity?.truncated).toBe(true);
    await db.execute('update growth_contacts set deleted_at=$2 where id=$1', [
      contactId,
      now,
    ]);
    const deleted = await readContactJourney(db, contactId);
    expect(deleted.state).toBe('redacted');
    expect(JSON.stringify(deleted)).not.toContain('Example');
  });
});
