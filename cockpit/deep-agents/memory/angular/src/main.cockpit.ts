// SPDX-License-Identifier: MIT
import { appConfig } from './app/app.config';
import { MemoryComponent } from './app/memory.component';
import { bootstrapWithCockpitHarness } from '@ngaf/cockpit-telemetry';

bootstrapWithCockpitHarness(MemoryComponent, appConfig);
