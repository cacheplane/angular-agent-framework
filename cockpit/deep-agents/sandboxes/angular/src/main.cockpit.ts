// SPDX-License-Identifier: MIT
import { appConfig } from './app/app.config';
import { SandboxesComponent } from './app/sandboxes.component';
import { bootstrapWithCockpitHarness } from '@ngaf/cockpit-telemetry';

bootstrapWithCockpitHarness(SandboxesComponent, appConfig);
