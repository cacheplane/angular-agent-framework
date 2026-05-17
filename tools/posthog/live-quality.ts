import { ph } from './client.js';
import {
  TELEMETRY_EVENT_CONTRACT,
  TELEMETRY_FORBIDDEN_PROPERTIES,
} from './telemetry-contract.js';

export interface LiveTelemetryEvent {
  event: string;
  timestamp: string;
  properties: Record<string, unknown>;
}

export type LiveQualityFindingKind =
  | 'missing_required_property'
  | 'forbidden_property'
  | 'unexpected_property';

export interface LiveQualityFinding {
  severity: 'error' | 'warning';
  kind: LiveQualityFindingKind;
  event: string;
  property: string;
  timestamp: string;
  message: string;
}

export interface FetchRecentContractEventsOptions {
  client: LiveTelemetryEventsClient;
  eventNames: readonly string[];
  after: string;
  limitPerEvent: number;
}

export interface LiveTelemetryEventsClient {
  GET(path: string, options: unknown): Promise<{ data?: { results?: LiveTelemetryEvent[] }; error?: unknown }>;
}

const INTERNAL_PROPERTY_NAMES = new Set([
  'distinct_id',
  'token',
  'uuid',
]);

function isMissing(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

function isInternalProperty(property: string): boolean {
  return property.startsWith('$') || INTERNAL_PROPERTY_NAMES.has(property);
}

export function analyzeTelemetryEvents(
  events: readonly LiveTelemetryEvent[],
  contract = TELEMETRY_EVENT_CONTRACT,
): LiveQualityFinding[] {
  const forbiddenProperties = new Set<string>(TELEMETRY_FORBIDDEN_PROPERTIES);
  const findings: LiveQualityFinding[] = [];

  for (const item of events) {
    const eventContract = contract[item.event];
    if (!eventContract) continue;

    const allowedProperties = new Set(eventContract.allowedProperties);
    for (const property of eventContract.requiredProperties) {
      if (isMissing(item.properties[property])) {
        findings.push({
          severity: 'error',
          kind: 'missing_required_property',
          event: item.event,
          property,
          timestamp: item.timestamp,
          message: `${item.event} is missing required property ${property}`,
        });
      }
    }

    for (const property of Object.keys(item.properties)) {
      if (forbiddenProperties.has(property)) {
        findings.push({
          severity: 'error',
          kind: 'forbidden_property',
          event: item.event,
          property,
          timestamp: item.timestamp,
          message: `${item.event} includes forbidden property ${property}`,
        });
        continue;
      }

      if (!isInternalProperty(property) && !allowedProperties.has(property)) {
        findings.push({
          severity: 'warning',
          kind: 'unexpected_property',
          event: item.event,
          property,
          timestamp: item.timestamp,
          message: `${item.event} includes non-contract property ${property}`,
        });
      }
    }
  }

  return findings;
}

export function hasBlockingFindings(findings: readonly LiveQualityFinding[]): boolean {
  return findings.some((finding) => finding.severity === 'error');
}

export async function fetchRecentContractEvents({
  client,
  eventNames,
  after,
  limitPerEvent,
}: FetchRecentContractEventsOptions): Promise<LiveTelemetryEvent[]> {
  const fetched: LiveTelemetryEvent[] = [];
  for (const event of eventNames) {
    const response = await client.GET('/events/', {
      params: {
        query: {
          after,
          event,
          format: 'json',
          limit: limitPerEvent,
        },
      },
    });

    if (response.error || response.data === undefined) {
      throw new Error(`PostHog events query failed for ${event}: ${JSON.stringify(response.error)}`);
    }
    fetched.push(...(response.data.results ?? []));
  }
  return fetched;
}

export function formatLiveQualityReport({
  checkedEvents,
  days,
  events,
  findings,
}: {
  checkedEvents: readonly string[];
  days: number;
  events: readonly LiveTelemetryEvent[];
  findings: readonly LiveQualityFinding[];
}): string {
  const lines: string[] = [];
  lines.push(`Live telemetry quality — last ${days} ${days === 1 ? 'day' : 'days'}`);
  lines.push('');
  lines.push('| Event | Sampled events |');
  lines.push('|-------|---------------:|');
  for (const event of checkedEvents) {
    const count = events.filter((item) => item.event === event).length;
    lines.push(`| ${event} | ${count} |`);
  }

  const errors = findings.filter((finding) => finding.severity === 'error');
  const warnings = findings.filter((finding) => finding.severity === 'warning');
  lines.push('');
  lines.push(`Errors: ${errors.length}`);
  lines.push(`Warnings: ${warnings.length}`);

  if (errors.length > 0) {
    lines.push('');
    lines.push('## Errors');
    for (const finding of errors) {
      lines.push(`- ${finding.message} (${finding.timestamp})`);
    }
  }

  if (warnings.length > 0) {
    lines.push('');
    lines.push('## Warnings');
    for (const finding of warnings) {
      lines.push(`- ${finding.message} (${finding.timestamp})`);
    }
  }

  return lines.join('\n');
}

function parseArgs(args: readonly string[]): { days: number; limitPerEvent: number } {
  let days = 7;
  let limitPerEvent = 100;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--days') {
      days = Number(args[i + 1]);
      i += 1;
    } else if (arg === '--limit-per-event') {
      limitPerEvent = Number(args[i + 1]);
      i += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!Number.isInteger(days) || days <= 0) throw new Error('--days must be a positive integer');
  if (!Number.isInteger(limitPerEvent) || limitPerEvent <= 0) {
    throw new Error('--limit-per-event must be a positive integer');
  }
  return { days, limitPerEvent };
}

async function main(): Promise<number> {
  let options: { days: number; limitPerEvent: number };
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    console.error('Usage: tsx tools/posthog/live-quality.ts [--days N] [--limit-per-event N]');
    return 1;
  }

  const checkedEvents = Object.keys(TELEMETRY_EVENT_CONTRACT).sort();
  const after = new Date(Date.now() - options.days * 24 * 60 * 60 * 1000).toISOString();
  try {
    const events = await fetchRecentContractEvents({
      client: ph() as LiveTelemetryEventsClient,
      eventNames: checkedEvents,
      after,
      limitPerEvent: options.limitPerEvent,
    });
    const findings = analyzeTelemetryEvents(events);
    console.log(formatLiveQualityReport({
      checkedEvents,
      days: options.days,
      events,
      findings,
    }));
    return hasBlockingFindings(findings) ? 1 : 0;
  } catch (err) {
    console.error(`Live telemetry quality check failed: ${err instanceof Error ? err.message : err}`);
    return 1;
  }
}

if (process.argv[1]?.endsWith('/live-quality.ts')) {
  main().then((code) => process.exit(code));
}
