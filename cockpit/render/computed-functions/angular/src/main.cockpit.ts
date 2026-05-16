// SPDX-License-Identifier: MIT
import { appConfig } from './app/app.config';
import { ComputedFunctionsComponent } from './app/computed-functions.component';
import { bootstrapWithCockpitHarness } from '@ngaf/cockpit-telemetry';

bootstrapWithCockpitHarness(ComputedFunctionsComponent, appConfig);
