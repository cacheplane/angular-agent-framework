// SPDX-License-Identifier: MIT
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';
import { appConfig } from './app/app.config';
import { ToolViewsComponent } from './app/tool-views.component';

void bootstrapWithCockpitHarness(ToolViewsComponent, appConfig).catch(console.error);
