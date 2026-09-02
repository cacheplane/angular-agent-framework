// SPDX-License-Identifier: MIT
import { ɵAG_UI_RUNTIME_OPERATION_REPORTER } from '@threadplane/ag-ui';
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';
import { appConfig } from './app/app.config';
import { SubagentsComponent } from './app/subagents.component';

void bootstrapWithCockpitHarness(SubagentsComponent, appConfig, {
  runtime: {
    adapter: 'ag-ui',
    sharedUrl: new URL('agent', document.baseURI).pathname,
    operationReporterToken: ɵAG_UI_RUNTIME_OPERATION_REPORTER,
  },
}).catch(() => undefined);
