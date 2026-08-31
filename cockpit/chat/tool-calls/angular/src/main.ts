// SPDX-License-Identifier: MIT
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';
import { appConfig } from './app/app.config';
import { ToolCallsComponent } from './app/tool-calls.component';

void bootstrapWithCockpitHarness(ToolCallsComponent, appConfig).catch(console.error);
