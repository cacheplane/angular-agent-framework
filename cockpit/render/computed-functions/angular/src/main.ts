// SPDX-License-Identifier: MIT
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';
import { appConfig } from './app/app.config';
import { ComputedFunctionsComponent } from './app/computed-functions.component';

void bootstrapWithCockpitHarness(ComputedFunctionsComponent, appConfig).catch(console.error);
