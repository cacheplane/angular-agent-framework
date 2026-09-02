import * as publicGrowth from '../index.ts';
import type {
  SqlExecutor,
  SqlQueryResult,
  SqlTransaction,
} from './database.ts';
import {
  GROWTH_SCORE_POLICY_VERSION,
  growthScoreTierFor,
  recomputeContactScore,
  recomputeProjectScore,
  scoreProjectActivities,
  type GrowthScoreActivity,
  type GrowthScoreContentRegistry,
} from './scoring.ts';

const registry: GrowthScoreContentRegistry = {
  version: 'content-registry:v1',
  entries: [
    { contentId: 'architecture-1', family: 'architecture' },
    { contentId: 'architecture-2', family: 'architecture' },
    { contentId: 'architecture-3', family: 'architecture' },
    { contentId: 'architecture-4', family: 'architecture' },
    { contentId: 'comparison-1', family: 'comparison' },
    { contentId: 'deployment-1', family: 'deployment' },
    { contentId: 'pricing-1', family: 'pricing' },
    { contentId: 'security-1', family: 'security' },
  ],
};

let activitySequence = 0;

function activity(
  kind: string,
  data: Record<string, unknown> = {},
  overrides: Partial<GrowthScoreActivity> = {}
): GrowthScoreActivity {
  return {
    eventKey: `event:${kind}:${(activitySequence += 1)}`,
    contactId: null,
    projectId: '00000000-0000-4000-8000-000000000001',
    kind,
    occurredAt: new Date('2026-09-01T12:00:00.000Z'),
    data,
    ...overrides,
  };
}

describe('public scoring surface', () => {
  it('does not expose an arbitrary caller-selected subject scorer', () => {
    expect(publicGrowth).not.toHaveProperty('scoreGrowthActivities');
    expect(publicGrowth).not.toHaveProperty('scoreContactActivities');
  });

  it('scores a project from only that project activities', () => {
    const projectId = '00000000-0000-4000-8000-000000000001';
    const result = scoreProjectActivities({
      projectId,
      activities: [
        activity(
          'transport.connected',
          { qualifying_projection: true },
          { projectId }
        ),
        activity(
          'runtime.first_stream_completed',
          { qualifying_projection: true },
          { projectId: 'unlinked' }
        ),
        activity(
          'docs:install_command_copied',
          { qualifying_projection: true },
          { projectId: null }
        ),
      ],
      contentRegistry: registry,
    });

    expect(result.subject).toEqual({ type: 'project', id: projectId });
    expect(result.score).toBe(15);
    expect(result.reasons.map(({ code }) => code)).toEqual([
      'transport.connected',
    ]);
  });
});

describe('versioned deterministic scoring', () => {
  it('deduplicates qualifying registered content and applies category caps', () => {
    const projectId = '00000000-0000-4000-8000-000000000001';
    const activities = [
      ...[
        'architecture-1',
        'architecture-2',
        'architecture-3',
        'architecture-4',
      ].flatMap((contentId) => [
        activity('marketing:content_engaged', {
          content_id: contentId,
          qualifying_projection: true,
        }),
        activity('marketing:content_engaged', {
          content_id: contentId,
          qualifying_projection: true,
        }),
      ]),
      ...['pricing-1', 'security-1', 'deployment-1'].map((contentId) =>
        activity('marketing:content_engaged', {
          content_id: contentId,
          qualifying_projection: true,
        })
      ),
      activity('marketing:content_engaged', {
        content_id: 'unregistered',
        qualifying_projection: true,
      }),
      activity('marketing:content_engaged', {
        content_id: 'comparison-1',
        qualifying_projection: false,
      }),
    ];

    const result = scoreProjectActivities({
      projectId,
      activities,
      contentRegistry: registry,
    });

    expect(result.score).toBe(35);
    expect(result.reasons).toEqual([
      {
        code: 'content.architecture_or_comparison',
        points: 15,
        identifiers: ['architecture-1', 'architecture-2', 'architecture-3'],
      },
      {
        code: 'content.pricing_security_deployment',
        points: 20,
        identifiers: ['deployment-1', 'pricing-1'],
      },
    ]);
  });

  it('binds score identity to policy, registry version, and canonical registry hash', () => {
    const first = scoreProjectActivities({
      projectId: 'project-1',
      activities: [],
      contentRegistry: registry,
    });
    const reordered = scoreProjectActivities({
      projectId: 'project-1',
      activities: [],
      contentRegistry: {
        ...registry,
        entries: [...registry.entries].reverse(),
      },
    });
    const changed = scoreProjectActivities({
      projectId: 'project-1',
      activities: [],
      contentRegistry: {
        ...registry,
        entries: registry.entries.map((entry) =>
          entry.contentId === 'architecture-1'
            ? { ...entry, family: 'pricing' as const }
            : entry
        ),
      },
    });

    expect(first.policyVersion).toBe(GROWTH_SCORE_POLICY_VERSION);
    expect(first.registryVersion).toBe('content-registry:v1');
    expect(first.registryHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(first.scoreVersion).toContain(first.registryHash);
    expect(reordered).toEqual(first);
    expect(changed.registryHash).not.toBe(first.registryHash);
    expect(changed.scoreVersion).not.toBe(first.scoreVersion);
  });

  it.each([
    {
      name: 'duplicate IDs',
      registry: {
        version: 'content-registry:v1',
        entries: [
          { contentId: 'same', family: 'architecture' },
          { contentId: 'same', family: 'comparison' },
        ],
      },
    },
    {
      name: 'blank version',
      registry: { version: ' ', entries: [] },
    },
    {
      name: 'malformed content ID',
      registry: {
        version: 'content-registry:v1',
        entries: [{ contentId: ' spaced ', family: 'architecture' }],
      },
    },
  ])('rejects $name', ({ registry: invalidRegistry }) => {
    expect(() =>
      scoreProjectActivities({
        projectId: 'project-1',
        activities: [],
        contentRegistry: invalidRegistry as GrowthScoreContentRegistry,
      })
    ).toThrow(/registry/u);
  });

  it.each([
    [0, 'low'],
    [14, 'low'],
    [15, 'medium'],
    [39, 'medium'],
    [40, 'high'],
    [69, 'high'],
    [70, 'very_high'],
  ] as const)('uses the exact tier boundary for %i', (score, tier) => {
    expect(growthScoreTierFor(score)).toBe(tier);
  });

  it('ignores unverified approval facts and AI-supplied score activities', async () => {
    const contactId = 'contact-1';
    const result = await recomputeContactFromRows([
      activity(
        'form.outreach_approved',
        {
          email_classification: 'work',
          policy_version: 'growth-v1',
          source: 'website',
          source_form: 'whitepaper',
          verification: 'user_supplied',
          ai_score: 1000,
        },
        { contactId, projectId: null }
      ),
      activity('ai.score_calculated', { score: 1000 }, { contactId }),
    ]);

    expect(result.score).toBe(0);
    expect(result.reasons).toEqual([]);
  });

  it('ignores spoofed activity rows without an authoritative projection marker', async () => {
    const contactId = 'contact-1';
    const result = await recomputeContactFromRows([
      activity(
        'docs:install_command_copied',
        {},
        { contactId, projectId: null }
      ),
      activity(
        'transport.connected',
        {},
        {
          contactId: null,
          projectId: 'linked-project',
        }
      ),
    ]);

    expect(result.score).toBe(0);
    expect(result.reasons).toEqual([]);
  });

  it.each(['personal', 'unknown'] as const)(
    'does not award form points to a server-verified %s address',
    async (emailClassification) => {
      const contactId = 'contact-1';
      const result = await recomputeContactFromRows([
        activity(
          'form.outreach_approved',
          {
            email_classification: emailClassification,
            policy_version: 'growth-v1',
            source: 'website',
            source_form: 'whitepaper',
            verification: 'server_verified',
          },
          { contactId, projectId: null }
        ),
      ]);

      expect(result.score).toBe(0);
    }
  );
});

function scoreExecutor(
  handler: (sql: string, parameters: readonly unknown[]) => SqlQueryResult
): {
  calls: { parameters: readonly unknown[]; sql: string }[];
  executor: SqlExecutor;
} {
  const calls: { parameters: readonly unknown[]; sql: string }[] = [];
  const transaction: SqlTransaction = {
    async execute<Row extends Record<string, unknown>>(
      sql: string,
      parameters: readonly unknown[] = []
    ): Promise<SqlQueryResult<Row>> {
      calls.push({ sql, parameters });
      return handler(sql, parameters) as SqlQueryResult<Row>;
    },
  };
  return {
    calls,
    executor: {
      execute: transaction.execute,
      transaction: (operation) => operation(transaction),
    },
  };
}

function toScoreRow(value: GrowthScoreActivity): Record<string, unknown> {
  return {
    event_key: value.eventKey,
    contact_id: value.contactId,
    project_id: value.projectId,
    kind: value.kind,
    occurred_at: value.occurredAt,
    data: value.data,
  };
}

async function recomputeContactFromRows(
  activities: readonly GrowthScoreActivity[]
) {
  const harness = scoreExecutor(() => ({
    rows: activities.map((value) => toScoreRow(value)),
  }));
  return recomputeContactScore(harness.executor, {
    contactId: 'contact-1',
    contentRegistry: registry,
  });
}

describe('score repositories', () => {
  it('keeps anonymous project scoring project-scoped', async () => {
    const harness = scoreExecutor(() => ({
      rows: [
        {
          event_key: 'runtime:1',
          contact_id: null,
          project_id: 'project-1',
          kind: 'transport.connected',
          occurred_at: new Date('2026-09-01T12:00:00.000Z'),
          data: { qualifying_projection: true },
        },
      ],
    }));

    const result = await recomputeProjectScore(harness.executor, {
      projectId: 'project-1',
      contentRegistry: registry,
    });

    expect(result.subject).toEqual({ type: 'project', id: 'project-1' });
    expect(result.score).toBe(15);
    expect(harness.calls[0]?.parameters).toEqual(['project-1']);
  });

  it('selects and verifies the authoritative contact activity set in one SQL statement', async () => {
    const contactId = 'contact-1';
    const harness = scoreExecutor((sql, parameters) => {
      expect(sql).toMatch(/a\.contact_id = \$1/u);
      expect(sql).toMatch(/a\.contact_id = \$1\s*and a\.project_id is null/u);
      expect(sql).toMatch(
        /a\.contact_id is null[\s\S]*a\.data->>'qualifying_projection' = 'true'[\s\S]*exists\s*\(\s*select 1\s*from growth_projects p/u
      );
      expect(sql).toMatch(/p\.contact_id = \$1/u);
      expect(sql).toMatch(/p\.claim_consumed_at is not null/u);
      expect(sql).toMatch(/p\.claim_method = 'one_time_secret'/u);
      expect(sql).toMatch(/claim\.kind = 'project\.claimed'/u);
      expect(sql).toMatch(/claim\.contact_id = \$1/u);
      expect(sql).toMatch(/claim\.project_id = p\.id/u);
      expect(sql).toMatch(
        /claim\.data->>'relationship' = 'self_claimed_project'/u
      );
      expect(sql).toMatch(/claim\.data->>'claim_method' = 'one_time_secret'/u);
      expect(sql).toMatch(/claim\.occurred_at = p\.claim_consumed_at/u);
      expect(sql).toMatch(/a\.data->>'qualifying_projection' = 'true'/u);
      expect(parameters).toEqual([contactId]);
      return {
        rows: [
          toScoreRow(
            activity(
              'docs:install_command_copied',
              { qualifying_projection: true },
              {
                contactId,
                projectId: null,
              }
            )
          ),
          toScoreRow(
            activity(
              'transport.connected',
              { qualifying_projection: true },
              {
                contactId: null,
                projectId: 'linked-project',
              }
            )
          ),
        ],
      };
    });

    const result = await recomputeContactScore(harness.executor, {
      contactId,
      contentRegistry: registry,
    });

    expect(result.subject).toEqual({ type: 'contact', id: 'contact-1' });
    expect(result.score).toBe(20);
    expect(harness.calls).toHaveLength(1);
  });

  it('excludes a row attributed to another contact even when its project is linked', async () => {
    const contactId = 'contact-1';
    const harness = scoreExecutor((sql) => {
      expect(sql.match(/a\.contact_id is null/gu)).toHaveLength(1);
      expect(sql).not.toMatch(/a\.contact_id = \$1\s+or\s+exists/u);
      return { rows: [] };
    });

    const result = await recomputeContactScore(harness.executor, {
      contactId,
      contentRegistry: registry,
    });

    expect(result.score).toBe(0);
  });

  it('requires an own verified claim relationship for linked project score rows', async () => {
    const harness = scoreExecutor((sql) => {
      expect(sql).toMatch(/p\.claim_consumed_at is not null/u);
      expect(sql).toMatch(/p\.claim_method = 'one_time_secret'/u);
      expect(sql).toMatch(/claim\.contact_id = \$1/u);
      expect(sql).toMatch(/claim\.project_id = p\.id/u);
      expect(sql).toMatch(/self_claimed_project/u);
      return { rows: [] };
    });

    const result = await recomputeContactScore(harness.executor, {
      contactId: 'contact-1',
      contentRegistry: registry,
    });

    expect(result.score).toBe(0);
  });
});
