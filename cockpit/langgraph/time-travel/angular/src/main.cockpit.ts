// SPDX-License-Identifier: MIT
import { appConfig } from './app/app.config';
import { TimeTravelComponent } from './app/time-travel.component';
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';

bootstrapWithCockpitHarness(TimeTravelComponent, appConfig);
