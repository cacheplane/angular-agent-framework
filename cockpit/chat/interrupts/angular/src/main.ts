// SPDX-License-Identifier: MIT
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';
import { appConfig } from './app/app.config';
import { InterruptsComponent } from './app/interrupts.component';

void bootstrapWithCockpitHarness(InterruptsComponent, appConfig).catch(console.error);
