// SPDX-License-Identifier: MIT
import { ɵLANGGRAPH_RUNTIME_OPERATION_REPORTER } from '@threadplane/langgraph';
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';
import { appConfig } from './app/app.config';
import { PlanningComponent } from './app/planning.component';
import { environment } from './environments/environment';

void bootstrapWithCockpitHarness(PlanningComponent, appConfig, {
  runtime: {
    adapter: 'langgraph',
    sharedApiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
    operationReporterToken: ɵLANGGRAPH_RUNTIME_OPERATION_REPORTER,
  },
}).catch(() => undefined);
