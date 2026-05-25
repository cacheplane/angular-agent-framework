// SPDX-License-Identifier: MIT
import { appConfig } from './app/app.config';
import { RepeatLoopsComponent } from './app/repeat-loops.component';
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';

bootstrapWithCockpitHarness(RepeatLoopsComponent, appConfig);
