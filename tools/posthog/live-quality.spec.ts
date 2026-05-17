import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeTelemetryEvents,
  fetchRecentContractEvents,
  formatLiveQualityReport,
  hasBlockingFindings,
  type LiveTelemetryEvent,
} from './live-quality.js';
import { TELEMETRY_EVENT_CONTRACT } from './telemetry-contract.js';

test('analyzeTelemetryEvents flags missing required and forbidden properties', () => {
  const findings = analyzeTelemetryEvents([
    {
      event: 'ngaf:runtime_request_created',
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
        event: 'ngaf:runtime_request_created',
        property: 'transport',
        kind: 'missing_required_property',
      },
      {
        severity: 'error',
        event: 'ngaf:runtime_request_created',
        property: 'messages',
        kind: 'forbidden_property',
      },
    ],
  );
  assert.equal(hasBlockingFindings(findings), true);
});

test('analyzeTelemetryEvents warns on non-contract properties but ignores PostHog metadata', () => {
  const findings = analyzeTelemetryEvents([
    {
      event: 'ngaf:stream_started',
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
    ],
  );
  assert.equal(hasBlockingFindings(findings), false);
});

test('formatLiveQualityReport summarizes clean coverage and warnings', () => {
  const events: LiveTelemetryEvent[] = [
    {
      event: 'ngaf:stream_started',
      timestamp: '2026-05-17T00:00:00Z',
      properties: { transport: 'langgraph', unexpected: true },
    },
  ];
  const findings = analyzeTelemetryEvents(events);

  const report = formatLiveQualityReport({
    days: 1,
    events,
    findings,
    checkedEvents: ['ngaf:stream_started', 'ngaf:stream_ended'],
  });

  assert.match(report, /Live telemetry quality — last 1 day/);
  assert.match(report, /\| ngaf:stream_started \| 1 \|/);
  assert.match(report, /\| ngaf:stream_ended \| 0 \|/);
  assert.match(report, /Warnings/);
  assert.match(report, /unexpected/);
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
              event: 'ngaf:stream_started',
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
    eventNames: ['ngaf:stream_started', 'ngaf:stream_ended'],
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
            event: 'ngaf:stream_started',
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
            event: 'ngaf:stream_ended',
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
      TELEMETRY_EVENT_CONTRACT[event].requiredProperties.map((property) => [property, 'x']),
    ),
  }));

  assert.equal(analyzeTelemetryEvents(events).some((finding) => finding.severity === 'error'), false);
});
