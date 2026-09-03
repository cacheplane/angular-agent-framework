import { ɵAG_UI_RUNTIME_OPERATION_REPORTER } from '@threadplane/ag-ui';
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';
import { appConfig } from './app/app.config';
import { A2uiComponent } from './app/a2ui.component';

void bootstrapWithCockpitHarness(A2uiComponent, appConfig, {
  runtime: {
    adapter: 'ag-ui',
    sharedUrl: new URL('agent', document.baseURI).pathname,
    operationReporterToken: ɵAG_UI_RUNTIME_OPERATION_REPORTER,
  },
}).catch(() => undefined);
