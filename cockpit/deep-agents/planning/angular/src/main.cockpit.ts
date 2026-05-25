// SPDX-License-Identifier: MIT
import { appConfig } from './app/app.config';
import { PlanningComponent } from './app/planning.component';
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';

bootstrapWithCockpitHarness(PlanningComponent, appConfig);
