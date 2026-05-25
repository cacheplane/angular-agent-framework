// SPDX-License-Identifier: MIT
import { appConfig } from './app/app.config';
import { StateManagementComponent } from './app/state-management.component';
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';

bootstrapWithCockpitHarness(StateManagementComponent, appConfig);
