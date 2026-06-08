// SPDX-License-Identifier: MIT
import { appConfig } from './app/app.config';
import { ToolViewsComponent } from './app/tool-views.component';
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';

bootstrapWithCockpitHarness(ToolViewsComponent, appConfig);
