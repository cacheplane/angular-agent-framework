// SPDX-License-Identifier: MIT
import { appConfig } from './app/app.config';
import { InputComponent } from './app/input.component';
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';

bootstrapWithCockpitHarness(InputComponent, appConfig);
