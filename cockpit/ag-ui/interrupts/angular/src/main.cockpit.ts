// SPDX-License-Identifier: MIT
import { appConfig } from './app/app.config';
import { InterruptsComponent } from './app/interrupts.component';
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';

bootstrapWithCockpitHarness(InterruptsComponent, appConfig);
