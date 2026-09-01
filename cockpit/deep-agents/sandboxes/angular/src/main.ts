// SPDX-License-Identifier: MIT
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';
import { appConfig } from './app/app.config';
import { SandboxesComponent } from './app/sandboxes.component';

void bootstrapWithCockpitHarness(SandboxesComponent, appConfig).catch(console.error);
