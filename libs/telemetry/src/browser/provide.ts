import { makeEnvironmentProviders, type EnvironmentProviders } from '@angular/core';
import { NGAF_TELEMETRY_CONFIG, type NgafTelemetryConfig } from './tokens';
import { NgafTelemetryService } from './service';

export function provideNgafTelemetry(config: NgafTelemetryConfig): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: NGAF_TELEMETRY_CONFIG, useValue: config },
    NgafTelemetryService,
  ]);
}
