// SPDX-License-Identifier: MIT
import { StreamingComponent } from './app/streaming.component';
import { appConfig } from './app/app.config';
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';

bootstrapWithCockpitHarness(StreamingComponent, appConfig);
