// SPDX-License-Identifier: MIT
import { InjectionToken } from '@angular/core';

export interface CockpitTelemetryConfig {
  /** PostHog project key. From URL param cockpit_phk. */
  posthogKey: string;
  /** PostHog ingest host. From cockpit_host param or default. */
  posthogHost?: string;
  /** Session-scoped distinct_id passed by the parent. */
  distinctId: string;
  /** Capability slug (e.g. 'langgraph-streaming'). */
  capabilitySlug: string;
  /** Sample rate. Default 1.0. */
  sampleRate?: number;
}

export const COCKPIT_TELEMETRY_CONFIG = new InjectionToken<CockpitTelemetryConfig>(
  'COCKPIT_TELEMETRY_CONFIG',
);
