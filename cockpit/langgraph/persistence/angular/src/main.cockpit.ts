import { ɵLANGGRAPH_RUNTIME_OPERATION_REPORTER } from '@threadplane/langgraph';
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';
import { appConfig } from './app/app.config';
import { PersistenceComponent } from './app/persistence.component';
import { environment } from './environments/environment';

void bootstrapWithCockpitHarness(PersistenceComponent, appConfig, {
  runtime: {
    adapter: 'langgraph',
    sharedApiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
    operationReporterToken: ɵLANGGRAPH_RUNTIME_OPERATION_REPORTER,
  },
}).catch(() => undefined);
