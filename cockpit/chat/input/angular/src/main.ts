// SPDX-License-Identifier: MIT
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';
import { appConfig } from './app/app.config';
import { InputComponent } from './app/input.component';

void bootstrapWithCockpitHarness(InputComponent, appConfig).catch(console.error);
