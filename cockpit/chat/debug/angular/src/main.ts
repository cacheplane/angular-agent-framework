// SPDX-License-Identifier: MIT
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';
import { appConfig } from './app/app.config';
import { DebugPageComponent } from './app/debug.component';

void bootstrapWithCockpitHarness(DebugPageComponent, appConfig).catch(console.error);
