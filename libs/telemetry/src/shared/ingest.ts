import type { ThreadplaneEvent } from './events.js';

const EVENTS: ReadonlySet<string> = new Set<ThreadplaneEvent>([
  'tplane:runtime_instance_created',
  'tplane:runtime_request_created',
  'tplane:stream_started',
  'tplane:stream_ended',
  'tplane:stream_errored',
  'tplane:browser_provided',
  'tplane:browser_chat_init',
]);

const STRING_PROPERTIES = new Set([
  'transport', 'surface', 'requestType', 'provider', 'model', 'errorClass', 'angularVersion',
]);

/** A validated public SDK event containing only bounded metadata. */
export interface ParsedTelemetryEvent {
  event: ThreadplaneEvent;
  properties: Record<string, string | number>;
}

/**
 * Validate untrusted public SDK events and copy only allowed primitive metadata.
 * Unknown properties are omitted; malformed known properties reject the event.
 * Returns null without exposing payload data or executing property getters.
 */
export function parseTelemetryEvent(event: unknown, properties: unknown): ParsedTelemetryEvent | null {
  try {
    if (typeof event !== 'string' || !EVENTS.has(event)) return null;
    if (properties === null || typeof properties !== 'object' || Array.isArray(properties)) return null;
    const prototype = Object.getPrototypeOf(properties);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const result: Record<string, string | number> = {};
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(properties))) {
      if (!STRING_PROPERTIES.has(key) && key !== 'durationMs' && key !== 'sample_weight') continue;
      if (!('value' in descriptor)) return null;
      const value: unknown = descriptor.value;
      if (value === undefined) continue;
      if (STRING_PROPERTIES.has(key)) {
        // eslint-disable-next-line no-control-regex -- Control characters are deliberately rejected from public metadata.
        if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/u.test(value)) return null;
        const label = value.trim();
        if (!label || label.length > 128) return null;
        result[key] = label;
      } else {
        if (typeof value !== 'number' || !Number.isFinite(value)) return null;
        if (key === 'durationMs' && (value < 0 || value > 86_400_000)) return null;
        if (key === 'sample_weight' && value < 1) return null;
        result[key] = value;
      }
    }
    if (event === 'tplane:browser_chat_init' && !result['surface']) return null;
    if (event !== 'tplane:browser_provided' && event !== 'tplane:browser_chat_init' && !result['transport']) return null;
    return { event: event as ThreadplaneEvent, properties: result };
  } catch {
    // JavaScript callers can pass hostile proxies as well as plain JSON data.
    return null;
  }
}
