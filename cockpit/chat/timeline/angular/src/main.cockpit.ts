// SPDX-License-Identifier: MIT
import { installEmbeddedTheme } from '@ngaf/example-layouts';
import { appConfig } from './app/app.config';
import { TimelineComponent } from './app/timeline.component';
import { bootstrapWithCockpitHarness } from '@ngaf/cockpit-telemetry';

installEmbeddedTheme();

bootstrapWithCockpitHarness(TimelineComponent, appConfig);
