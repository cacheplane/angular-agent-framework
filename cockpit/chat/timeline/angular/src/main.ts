// SPDX-License-Identifier: MIT
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';
import { appConfig } from './app/app.config';
import { TimelineComponent } from './app/timeline.component';

void bootstrapWithCockpitHarness(TimelineComponent, appConfig).catch(console.error);
