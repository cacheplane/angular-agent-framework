// SPDX-License-Identifier: MIT
import { appConfig } from './app/app.config';
import { ToolCallsComponent } from './app/tool-calls.component';
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';

bootstrapWithCockpitHarness(ToolCallsComponent, appConfig);
