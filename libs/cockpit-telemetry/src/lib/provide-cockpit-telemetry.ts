// SPDX-License-Identifier: MIT
import {
  makeEnvironmentProviders,
  type EnvironmentProviders,
  ENVIRONMENT_INITIALIZER,
  inject,
} from '@angular/core';
import { COCKPIT_TELEMETRY_CONFIG, type CockpitTelemetryConfig } from './tokens';
import { CockpitTelemetryService } from './cockpit-telemetry.service';
import { ActivationAggregator } from './activation-aggregator';
import { AgentLifecycleRegistry } from '@threadplane/langgraph';

export function provideCockpitTelemetry(
  config: CockpitTelemetryConfig,
): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: COCKPIT_TELEMETRY_CONFIG, useValue: config },
    ActivationAggregator,
    AgentLifecycleRegistry,
    CockpitTelemetryService,
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useFactory: () => {
        const svc = inject(CockpitTelemetryService);
        return () => svc.init();
      },
    },
  ]);
}
