// SPDX-License-Identifier: MIT
import { ɵLANGGRAPH_RUNTIME_OPERATION_REPORTER } from '@threadplane/langgraph';
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';
import { appConfig } from './app/app.config';
import { ClientToolsComponent } from './app/client-tools.component';
import { environment } from './environments/environment';

void bootstrapWithCockpitHarness(ClientToolsComponent, appConfig, {
  runtime: {
    adapter: 'langgraph',
    sharedApiUrl: environment.langGraphApiUrl,
    assistantId: environment.clientToolsAssistantId,
    operationReporterToken: ɵLANGGRAPH_RUNTIME_OPERATION_REPORTER,
  },
}).catch(() => undefined);
