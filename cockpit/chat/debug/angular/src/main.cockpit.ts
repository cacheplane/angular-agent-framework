// SPDX-License-Identifier: MIT
import { appConfig } from './app/app.config';
import { DebugPageComponent } from './app/debug.component';
import { bootstrapWithCockpitHarness } from '@ngaf/cockpit-telemetry';

bootstrapWithCockpitHarness(DebugPageComponent, appConfig);
