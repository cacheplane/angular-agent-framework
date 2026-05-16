// SPDX-License-Identifier: MIT
import { appConfig } from './app/app.config';
import { ThreadsComponent } from './app/threads.component';
import { bootstrapWithCockpitHarness } from '@ngaf/cockpit-telemetry';

bootstrapWithCockpitHarness(ThreadsComponent, appConfig);
