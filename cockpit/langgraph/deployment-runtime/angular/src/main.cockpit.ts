// SPDX-License-Identifier: MIT
import { appConfig } from './app/app.config';
import { DeploymentRuntimeComponent } from './app/deployment-runtime.component';
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';

bootstrapWithCockpitHarness(DeploymentRuntimeComponent, appConfig);
