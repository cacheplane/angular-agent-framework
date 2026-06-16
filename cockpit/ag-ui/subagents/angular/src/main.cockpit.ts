// SPDX-License-Identifier: MIT
import { appConfig } from './app/app.config';
import { SubagentsComponent } from './app/subagents.component';
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';

bootstrapWithCockpitHarness(SubagentsComponent, appConfig);
