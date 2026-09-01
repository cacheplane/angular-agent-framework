// SPDX-License-Identifier: MIT
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';
import { appConfig } from './app/app.config';
import { ThreadsComponent } from './app/threads.component';

void bootstrapWithCockpitHarness(ThreadsComponent, appConfig).catch(console.error);
