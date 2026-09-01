// SPDX-License-Identifier: MIT
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';
import { appConfig } from './app/app.config';
import { PlanningComponent } from './app/planning.component';

void bootstrapWithCockpitHarness(PlanningComponent, appConfig).catch(console.error);
