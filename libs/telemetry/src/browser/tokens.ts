import { InjectionToken } from '@angular/core';

export type NgafTelemetryEvent =
  | 'ngaf:browser_provided'
  | 'ngaf:browser_chat_init'
  | 'ngaf:runtime_instance_created'
  | 'ngaf:runtime_request_created'
  | 'ngaf:stream_started'
  | 'ngaf:stream_ended'
  | 'ngaf:stream_errored';

export interface NgafTelemetryEventPayload {
  event: NgafTelemetryEvent;
  properties?: Record<string, unknown>;
}

export type NgafTelemetrySink = (payload: NgafTelemetryEventPayload) => void | Promise<void>;

export interface NgafTelemetryConfig {
  enabled: boolean;
  /**
   * Preferred app-owned delivery hook. Use this when the consuming app wants
   * to forward events through its own analytics boundary.
   */
  sink?: NgafTelemetrySink;
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

export const NGAF_TELEMETRY_CONFIG = new InjectionToken<NgafTelemetryConfig | null>(
  'NGAF_TELEMETRY_CONFIG',
);
