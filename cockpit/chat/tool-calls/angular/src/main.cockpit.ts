// SPDX-License-Identifier: MIT
import { appConfig } from './app/app.config';
import { ToolCallsComponent } from './app/tool-calls.component';
import { bootstrapWithCockpitHarness } from '@ngaf/cockpit-telemetry';

bootstrapWithCockpitHarness(ToolCallsComponent, appConfig);
