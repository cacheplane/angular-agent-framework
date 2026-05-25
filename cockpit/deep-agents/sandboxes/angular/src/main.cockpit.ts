// SPDX-License-Identifier: MIT
import { appConfig } from './app/app.config';
import { SandboxesComponent } from './app/sandboxes.component';
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';

bootstrapWithCockpitHarness(SandboxesComponent, appConfig);
