import { makeEnvironmentProviders, type EnvironmentProviders } from '@angular/core';
import { THREADPLANE_TELEMETRY_CONFIG, type ThreadplaneTelemetryConfig } from './tokens';
import { ThreadplaneTelemetryService } from './service';

/**
 * Provide browser telemetry configuration for an Angular app.
 *
 * Browser telemetry remains off unless this provider is installed with
 * `enabled: true`. Delivery goes through `sink`, `endpoint`, or the legacy
 * PostHog options configured on `ThreadplaneTelemetryConfig`.
 */
export function provideThreadplaneTelemetry(config: ThreadplaneTelemetryConfig): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: THREADPLANE_TELEMETRY_CONFIG, useValue: config },
    ThreadplaneTelemetryService,
  ]);
}
