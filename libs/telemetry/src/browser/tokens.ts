import { InjectionToken } from '@angular/core';

export type ThreadplaneTelemetryEvent =
  | 'tplane:browser_provided'
  | 'tplane:browser_chat_init'
  | 'tplane:runtime_instance_created'
  | 'tplane:runtime_request_created'
  | 'tplane:stream_started'
  | 'tplane:stream_ended'
  | 'tplane:stream_errored';

export interface ThreadplaneTelemetryEventPayload {
  event: ThreadplaneTelemetryEvent;
  properties?: Record<string, unknown>;
}

export type ThreadplaneTelemetrySink = (payload: ThreadplaneTelemetryEventPayload) => void | Promise<void>;

export interface ThreadplaneTelemetryConfig {
  enabled: boolean;
  /**
   * Preferred app-owned delivery hook. Use this when the consuming app wants
   * to forward events through its own analytics boundary.
   */
  sink?: ThreadplaneTelemetrySink;
  /**
   * Preferred app-owned ingest URL. The browser service POSTs neutral event
   * payloads here; the endpoint decides where they ultimately go.
   */
  endpoint?: string;
  /** @deprecated Prefer sink or endpoint so public app code is vendor-neutral. */
  posthogKey?: string;
  /** @deprecated Prefer sink or endpoint so public app code is vendor-neutral. */
  posthogHost?: string;
  sampleRate?: number;
}

export const THREADPLANE_TELEMETRY_CONFIG = new InjectionToken<ThreadplaneTelemetryConfig | null>(
  'THREADPLANE_TELEMETRY_CONFIG',
);
