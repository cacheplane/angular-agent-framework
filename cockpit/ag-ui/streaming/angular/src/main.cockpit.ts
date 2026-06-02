// SPDX-License-Identifier: MIT
import { appConfig } from './app/app.config';
import { StreamingComponent } from './app/streaming.component';
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';

bootstrapWithCockpitHarness(StreamingComponent, appConfig);
