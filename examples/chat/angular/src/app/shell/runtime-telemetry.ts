// SPDX-License-Identifier: MIT
import type {
  AgentRuntimeTelemetryEvent,
  AgentRuntimeTelemetrySink,
} from '@threadplane/chat';

const CANONICAL_DEMO_SURFACE = 'canonical_demo';
const BLOCKED_PROPERTY_KEYS = new Set([
  'messages',
  'threadId',
  'assistantId',
  'apiUrl',
]);

export interface BrowserTelemetryCapture {
  capture(event: AgentRuntimeTelemetryEvent, properties?: Record<string, unknown>): Promise<void>;
}

export function createCanonicalDemoRuntimeTelemetrySink(
  telemetry: BrowserTelemetryCapture,
  readModel: () => string,
): AgentRuntimeTelemetrySink {
  return ({ event, properties }) => {
    const safeProperties: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(properties ?? {})) {
      if (!BLOCKED_PROPERTY_KEYS.has(key)) safeProperties[key] = value;
    }
    return telemetry.capture(event, {
      ...safeProperties,
      surface: CANONICAL_DEMO_SURFACE,
      model: readModel(),
    });
  };
}
