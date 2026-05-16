// SPDX-License-Identifier: MIT
import { appConfig } from './app/app.config';
import { TimeTravelComponent } from './app/time-travel.component';
import { bootstrapWithCockpitHarness } from '@ngaf/cockpit-telemetry';

bootstrapWithCockpitHarness(TimeTravelComponent, appConfig);
