// SPDX-License-Identifier: MIT
import { appConfig } from './app/app.config';
import { ThreadsComponent } from './app/threads.component';
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';

bootstrapWithCockpitHarness(ThreadsComponent, appConfig);
