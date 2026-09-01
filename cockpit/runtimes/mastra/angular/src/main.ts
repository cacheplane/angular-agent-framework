// SPDX-License-Identifier: MIT
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';
import { appConfig } from './app/app.config';
import { MastraComponent } from './app/mastra.component';

void bootstrapWithCockpitHarness(MastraComponent, appConfig).catch(console.error);
