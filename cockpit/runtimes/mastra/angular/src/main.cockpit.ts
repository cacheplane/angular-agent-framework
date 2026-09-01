// SPDX-License-Identifier: MIT
import { appConfig } from './app/app.config';
import { MastraComponent } from './app/mastra.component';
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';

bootstrapWithCockpitHarness(MastraComponent, appConfig);
