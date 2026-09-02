// SPDX-License-Identifier: MIT
import { ɵLANGGRAPH_RUNTIME_OPERATION_REPORTER } from '@threadplane/langgraph';
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';
import { appConfig } from './app/app.config';
import { GenerativeUiComponent } from './app/generative-ui.component';
import { environment } from './environments/environment';

void bootstrapWithCockpitHarness(GenerativeUiComponent, appConfig, {
  runtime: {
    adapter: 'langgraph',
    sharedApiUrl: environment.langGraphApiUrl,
    assistantId: environment.generativeUiAssistantId,
    operationReporterToken: ɵLANGGRAPH_RUNTIME_OPERATION_REPORTER,
  },
}).catch(() => undefined);
