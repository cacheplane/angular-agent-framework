import { makeEnvironmentProviders, type EnvironmentProviders } from '@angular/core';
import { NGAF_TELEMETRY_CONFIG, type NgafTelemetryConfig } from './tokens.js';
import { NgafTelemetryService } from './service.js';

export function provideNgafTelemetry(config: NgafTelemetryConfig): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: NGAF_TELEMETRY_CONFIG, useValue: config },
    NgafTelemetryService,
  ]);
}
