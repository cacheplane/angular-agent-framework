import { ɵLANGGRAPH_RUNTIME_OPERATION_REPORTER } from '@threadplane/langgraph';
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';
import { appConfig } from './app/app.config';
import { InterruptsComponent } from './app/interrupts.component';
import { environment } from './environments/environment';

void bootstrapWithCockpitHarness(InterruptsComponent, appConfig, {
  runtime: {
    adapter: 'langgraph',
    sharedApiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
    operationReporterToken: ɵLANGGRAPH_RUNTIME_OPERATION_REPORTER,
  },
}).catch(() => undefined);
