// SPDX-License-Identifier: MIT
import { appConfig } from './app/app.config';
import { ComputedFunctionsComponent } from './app/computed-functions.component';
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';

bootstrapWithCockpitHarness(ComputedFunctionsComponent, appConfig);
