// SPDX-License-Identifier: MIT
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';
import { appConfig } from './app/app.config';
import { TimeTravelComponent } from './app/time-travel.component';

void bootstrapWithCockpitHarness(TimeTravelComponent, appConfig).catch(console.error);
