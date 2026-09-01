// SPDX-License-Identifier: MIT
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';
import { appConfig } from './app/app.config';
import { MemoryComponent } from './app/memory.component';

void bootstrapWithCockpitHarness(MemoryComponent, appConfig).catch(console.error);
