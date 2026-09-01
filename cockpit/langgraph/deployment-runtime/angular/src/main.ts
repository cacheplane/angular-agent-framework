// SPDX-License-Identifier: MIT
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';
import { appConfig } from './app/app.config';
import { DeploymentRuntimeComponent } from './app/deployment-runtime.component';

void bootstrapWithCockpitHarness(DeploymentRuntimeComponent, appConfig).catch(console.error);
