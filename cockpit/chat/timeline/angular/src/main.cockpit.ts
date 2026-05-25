// SPDX-License-Identifier: MIT
import { installEmbeddedTheme } from '@threadplane/example-layouts';
import { appConfig } from './app/app.config';
import { TimelineComponent } from './app/timeline.component';
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';

installEmbeddedTheme();

bootstrapWithCockpitHarness(TimelineComponent, appConfig);
