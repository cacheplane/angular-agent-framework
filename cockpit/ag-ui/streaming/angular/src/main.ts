// SPDX-License-Identifier: MIT
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';
import { appConfig } from './app/app.config';
import { StreamingComponent } from './app/streaming.component';

void bootstrapWithCockpitHarness(StreamingComponent, appConfig).catch(console.error);
