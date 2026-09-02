import { describe, expect, it } from 'vitest';

import {
  createGrowthActionToken,
  recomputeContactScore,
  type SqlExecutor,
} from '@threadplane-internal/growth';

import { renderInternalNotificationSummary } from './templates.js';

const TOKEN_KEY = {
  version: 7,
  secret: 'task-13-founder-stop-token-secret-material',
};
const TOKEN_INPUT = {
  contactId: '00000000-0000-4000-8000-000000000013',
  issuedAt: new Date('2026-09-01T12:00:00.000Z'),
  eventNonce: 'founder-review-13',
};
const FOUNDER_STOP_TOKEN = createGrowthActionToken(
  { ...TOKEN_INPUT, purpose: 'founder_stop' },
  TOKEN_KEY
);
const UNSUBSCRIBE_TOKEN = createGrowthActionToken(
  { ...TOKEN_INPUT, purpose: 'unsubscribe' },
  TOKEN_KEY
);
const STOP_URL = `https://threadplane.ai/api/growth/stop?token=${FOUNDER_STOP_TOKEN}`;

const INPUT = {
  scoreVersion: 'growth-score:v1',
  scoreReasons: [
    {
      code: 'contact.approved_work_email_form' as const,
      points: 30,
      identifiers: ['once'],
    },
    {
      code: 'runtime.first_stream_completed' as const,
      points: 20,
      identifiers: ['one'],
    },
  ],
  evidenceSourceUrls: ['https://example.com/about', 'https://example.com/docs'],
  drafts: [
    { subject: 'First note', body: 'A concise first preview.' },
    { subject: 'Second note', body: 'Would a debugging pattern help?' },
    { subject: 'Final note', body: 'This is the last short preview.' },
  ],
  founderStopUrl: STOP_URL,
};

describe('renderInternalNotificationSummary', () => {
  it('accepts the canonical score version emitted by contact recomputation', async () => {
    const score = await recomputeContactScore(
      {
        async execute() {
          return {
            rows: [
              {
                event_key: 'form:approved',
                contact_id: TOKEN_INPUT.contactId,
                project_id: null,
                kind: 'form.outreach_approved',
                occurred_at: TOKEN_INPUT.issuedAt,
                data: {
                  email_classification: 'work',
                  verification: 'server_verified',
                  policy_version: 'growth-v1',
                  source: 'website',
                  source_form: 'pricing',
                },
              },
            ],
          };
        },
      } as unknown as SqlExecutor,
      {
        contactId: TOKEN_INPUT.contactId,
        contentRegistry: { version: 'content-registry:v1', entries: [] },
      }
    );

    expect(score.scoreVersion).toContain('+registry:');
    expect(score.scoreVersion.length).toBeGreaterThan(80);
    expect(() =>
      renderInternalNotificationSummary({
        ...INPUT,
        scoreVersion: score.scoreVersion,
        scoreReasons: score.reasons,
      })
    ).not.toThrow();
  });

  it('renders bounded deterministic review context and all three draft previews', () => {
    const summary = renderInternalNotificationSummary(INPUT);

    expect(typeof summary).toBe('string');
    expect(summary).toContain('Review only');
    expect(summary).toContain('does not authorize or schedule');
    expect(summary).toContain('Score version: growth-score:v1');
    expect(summary).toContain('- contact.approved_work_email_form: 30 points');
    expect(summary).toContain('- runtime.first_stream_completed: 20 points');
    expect(summary).toContain('- https://example.com/about');
    expect(summary).toContain('- https://example.com/docs');
    expect(summary).toContain('Draft 1 — First note');
    expect(summary).toContain('Draft 2 — Second note');
    expect(summary).toContain('Draft 3 — Final note');
    expect(summary).toContain('Review or stop this contact');
    expect(summary).toContain(STOP_URL);
    expect(summary).not.toMatch(/<\/?[a-z][^>]*>/iu);
  });

  it('bounds draft previews and excludes identifiers and raw research bodies', () => {
    const summary = renderInternalNotificationSummary({
      ...INPUT,
      scoreReasons: [
        {
          ...INPUT.scoreReasons[0],
          identifiers: ['secret-internal-identifier'],
        },
      ],
      drafts: INPUT.drafts.map((draft, index) => ({
        ...draft,
        body: `${index} ${'bounded '.repeat(100)}?`,
      })),
    });

    expect(summary).not.toContain('secret-internal-identifier');
    expect(summary).not.toContain('bounded '.repeat(100));
    expect(summary.length).toBeLessThan(3_000);
  });

  it('neutralizes violating AI drafts rather than reproducing hostile content', () => {
    const summary = renderInternalNotificationSummary({
      ...INPUT,
      drafts: [
        {
          subject: '<img src=x onerror=alert(1)>',
          body: 'I saw you. https://evil.example/click',
        },
        INPUT.drafts[1],
        INPUT.drafts[2],
      ],
    });

    expect(summary).toContain('Draft 1 — rejected by recipient-copy checks');
    expect(summary).not.toContain('<img');
    expect(summary).not.toContain('evil.example');
    expect(summary).not.toContain('I saw you');
  });

  it.each([
    `http://threadplane.ai/api/growth/stop?token=${FOUNDER_STOP_TOKEN}`,
    `https://evil.example/api/growth/stop?token=${FOUNDER_STOP_TOKEN}`,
    `https://threadplane.ai/api/unsubscribe?token=${FOUNDER_STOP_TOKEN}`,
    `https://user:pass@threadplane.ai/api/growth/stop?token=${FOUNDER_STOP_TOKEN}`,
    'https://threadplane.ai/api/growth/stop?email=ada@example.com',
    'https://threadplane.ai/api/growth/stop?token=ada@example.com',
    'https://threadplane.ai/api/growth/stop?token=short',
    'https://threadplane.ai/api/growth/stop?token=' + 'a'.repeat(1_300),
    `https://threadplane.ai/api/growth/stop?token=${FOUNDER_STOP_TOKEN}&email=ada@example.com`,
    `https://threadplane.ai/api/growth/stop?token=${FOUNDER_STOP_TOKEN}#recipient`,
    `https://threadplane.ai/api/growth/stop?token=${UNSUBSCRIBE_TOKEN}`,
    `https://threadplane.ai/api/growth/stop?token=g1.${'a'.repeat(
      80
    )}.signature`,
  ])(
    'rejects an unsafe or unbounded founder stop URL: %s',
    (founderStopUrl) => {
      expect(() =>
        renderInternalNotificationSummary({ ...INPUT, founderStopUrl })
      ).toThrow(/founder stop URL/iu);
    }
  );

  it.each([
    'http://example.com/about',
    'https://user:pass@example.com/about',
    'https://example.com/about\nBcc: victim@example.com',
    'https://example.com/\u0001control',
    'https://example.com/<img src=x>',
    'https://example.com/ada@example.com',
    'https://example.com/about?contact=ada',
    'https://example.com/about#person-13',
    'https://example.com/contacts/00000000-0000-4000-8000-000000000013',
    `https://example.com/research/${'a'.repeat(40)}`,
    `https://example.com/source/${'Ab9_-xY7'.repeat(5)}`,
    'https://example.com/' + 'x'.repeat(600),
  ])('rejects an unsafe evidence source URL: %s', (sourceUrl) => {
    expect(() =>
      renderInternalNotificationSummary({
        ...INPUT,
        evidenceSourceUrls: [sourceUrl],
      })
    ).toThrow();
  });

  it.each([
    'https://example.com/about',
    'https://example.com/docs',
    'https://example.com/company/team',
  ])('keeps a short descriptive public evidence path: %s', (sourceUrl) => {
    expect(
      renderInternalNotificationSummary({
        ...INPUT,
        evidenceSourceUrls: [sourceUrl],
      })
    ).toContain(sourceUrl);
  });

  it('rejects unbounded arrays, arbitrary fields, and arbitrary score text', () => {
    expect(() =>
      renderInternalNotificationSummary({
        ...INPUT,
        scoreReasons: Array.from({ length: 11 }, () => INPUT.scoreReasons[0]),
      })
    ).toThrow();
    expect(() =>
      renderInternalNotificationSummary({
        ...INPUT,
        evidenceSourceUrls: Array.from(
          { length: 4 },
          (_, index) => `https://example.com/${index}`
        ),
      })
    ).toThrow();
    expect(() =>
      renderInternalNotificationSummary({
        ...INPUT,
        rawResearchPageBody: '<html>private body</html>',
      })
    ).toThrow();
    expect(() =>
      renderInternalNotificationSummary({
        ...INPUT,
        scoreVersion: 'growth-score:v1\nBcc: victim@example.com',
      })
    ).toThrow();
  });
});
