import { makeEnvironmentProviders, type EnvironmentProviders } from '@angular/core';
import { THREADPLANE_TELEMETRY_CONFIG, type ThreadplaneTelemetryConfig } from './tokens';
import { ThreadplaneTelemetryService } from './service';

export function provideThreadplaneTelemetry(config: ThreadplaneTelemetryConfig): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: THREADPLANE_TELEMETRY_CONFIG, useValue: config },
    ThreadplaneTelemetryService,
  ]);
}
