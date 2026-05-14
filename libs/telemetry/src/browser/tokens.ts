import { InjectionToken } from '@angular/core';

export interface NgafTelemetryConfig {
  enabled: boolean;
  posthogKey?: string;
  posthogHost?: string;
  sampleRate?: number;
}

export const NGAF_TELEMETRY_CONFIG = new InjectionToken<NgafTelemetryConfig | null>(
  'NGAF_TELEMETRY_CONFIG',
);
