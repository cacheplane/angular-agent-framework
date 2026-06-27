import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeTelemetryEvents,
  analyzeTelemetryCoverage,
  fetchRecentContractEvents,
  formatLiveQualityReport,
  hasBlockingFindings,
  type LiveCoverageRequirement,
  type LiveTelemetryEvent,
} from './live-quality.js';
import { TELEMETRY_EVENT_CONTRACT } from './telemetry-contract.js';

test('analyzeTelemetryEvents flags missing required and forbidden properties', () => {
  const findings = analyzeTelemetryEvents([
    {
      event: 'tplane:runtime_request_created',
      timestamp: '2026-05-17T00:00:00Z',
      properties: { messages: [{ content: 'hello' }] },
    },
  ]);

  assert.deepEqual(
    findings.map((finding) => ({
      severity: finding.severity,
      event: finding.event,
      property: finding.property,
      kind: finding.kind,
    })),
    [
      {
        severity: 'error',
        event: 'tplane:runtime_request_created',
        property: 'transport',
        kind: 'missing_required_property',
      },
      {
        severity: 'error',
        event: 'tplane:runtime_request_created',
        property: 'messages',
        kind: 'forbidden_property',
      },
    ]
  );
  assert.equal(hasBlockingFindings(findings), true);
});

test('analyzeTelemetryEvents warns on non-contract properties but ignores PostHog metadata', () => {
  const findings = analyzeTelemetryEvents([
    {
      event: 'tplane:stream_started',
      timestamp: '2026-05-17T00:00:00Z',
      properties: {
        transport: 'langgraph',
        accidental_extra: true,
        $current_url: 'https://example.test',
        token: 'phc_x',
      },
    },
  ]);

  assert.deepEqual(
    findings.map((finding) => ({
      severity: finding.severity,
      property: finding.property,
      kind: finding.kind,
    })),
    [
      {
        severity: 'warning',
        property: 'accidental_extra',
        kind: 'unexpected_property',
      },
    ]
  );
  assert.equal(hasBlockingFindings(findings), false);
});

test('analyzeTelemetryEvents ignores PostHog attribution metadata', () => {
  const findings = analyzeTelemetryEvents([
    {
      event: 'marketing:cta_click',
      timestamp: '2026-05-17T00:00:00Z',
      properties: {
        cta_id: 'hero_docs',
        gclid: 'click-id',
        fbclid: 'click-id',
        utm_source: 'newsletter',
        utm_campaign: 'launch',
      },
    },
  ]);

  assert.deepEqual(findings, []);
});

test('formatLiveQualityReport summarizes clean coverage and warnings', () => {
  const events: LiveTelemetryEvent[] = [
    {
      event: 'tplane:stream_started',
      timestamp: '2026-05-17T00:00:00Z',
      properties: { transport: 'langgraph', unexpected: true },
    },
  ];
  const findings = analyzeTelemetryEvents(events);

  const report = formatLiveQualityReport({
    days: 1,
    events,
    findings,
    checkedEvents: ['tplane:stream_started', 'tplane:stream_ended'],
  });

  assert.match(report, /Live telemetry quality — last 1 day/);
  assert.match(report, /\| tplane:stream_started \| 1 \|/);
  assert.match(report, /\| tplane:stream_ended \| 0 \|/);
  assert.match(report, /Warnings/);
  assert.match(report, /unexpected/);
});

test('analyzeTelemetryCoverage flags required events with no recent samples', () => {
  const requirements: LiveCoverageRequirement[] = [
    { event: 'tplane:runtime_request_created', minCount: 1 },
    { event: 'tplane:stream_started', minCount: 2 },
  ];

  const findings = analyzeTelemetryCoverage(
    [
      {
        event: 'tplane:stream_started',
        timestamp: '2026-05-17T00:00:00Z',
        properties: { transport: 'langgraph' },
      },
    ],
    requirements
  );

  assert.deepEqual(
    findings.map((finding) => ({
      severity: finding.severity,
      event: finding.event,
      property: finding.property,
      kind: finding.kind,
      message: finding.message,
    })),
    [
      {
        severity: 'error',
        event: 'tplane:runtime_request_created',
        property: 'event_count',
        kind: 'insufficient_event_coverage',
        message:
          'tplane:runtime_request_created has 0 recent events; expected at least 1',
      },
      {
        severity: 'error',
        event: 'tplane:stream_started',
        property: 'event_count',
        kind: 'insufficient_event_coverage',
        message: 'tplane:stream_started has 1 recent event; expected at least 2',
      },
    ]
  );
  assert.equal(hasBlockingFindings(findings), true);
});

test('formatLiveQualityReport includes coverage requirements', () => {
  const report = formatLiveQualityReport({
    days: 7,
    events: [],
    findings: analyzeTelemetryCoverage(
      [],
      [{ event: 'tplane:postinstall', minCount: 1 }]
    ),
    checkedEvents: ['tplane:postinstall'],
    coverageRequirements: [{ event: 'tplane:postinstall', minCount: 1 }],
  });

  assert.match(report, /\| Event \| Sampled events \| Required minimum \|/);
  assert.match(report, /\| tplane:postinstall \| 0 \| 1 \|/);
  assert.match(report, /insufficient_event_coverage/);
});

test('fetchRecentContractEvents requests each contract event with bounded limits', async () => {
  const calls: unknown[] = [];
  const client = {
    GET: async (path: string, options: unknown) => {
      calls.push({ path, options });
      return {
        data: {
          results: [
            {
              event: 'tplane:stream_started',
              timestamp: '2026-05-17T00:00:00Z',
              properties: { transport: 'langgraph' },
            },
          ],
        },
      };
    },
  };

  const events = await fetchRecentContractEvents({
    client,
    eventNames: ['tplane:stream_started', 'tplane:stream_ended'],
    after: '2026-05-16T00:00:00.000Z',
    limitPerEvent: 25,
  });

  assert.equal(events.length, 2);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls, [
    {
      path: '/events/',
      options: {
        params: {
          query: {
            after: '2026-05-16T00:00:00.000Z',
            event: 'tplane:stream_started',
            format: 'json',
            limit: 25,
          },
        },
      },
    },
    {
      path: '/events/',
      options: {
        params: {
          query: {
            after: '2026-05-16T00:00:00.000Z',
            event: 'tplane:stream_ended',
            format: 'json',
            limit: 25,
          },
        },
      },
    },
  ]);
});

test('every contracted event can be analyzed without a bespoke case', () => {
  const events = Object.keys(TELEMETRY_EVENT_CONTRACT).map((event) => ({
    event,
    timestamp: '2026-05-17T00:00:00Z',
    properties: Object.fromEntries(
      TELEMETRY_EVENT_CONTRACT[event].requiredProperties.map((property) => [
        property,
        'x',
      ])
    ),
  }));

  assert.equal(
    analyzeTelemetryEvents(events).some(
      (finding) => finding.severity === 'error'
    ),
    false
  );
});
