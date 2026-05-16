// SPDX-License-Identifier: MIT
import { appConfig } from './app/app.config';
import { RegistryComponent } from './app/registry.component';
import { bootstrapWithCockpitHarness } from '@ngaf/cockpit-telemetry';

bootstrapWithCockpitHarness(RegistryComponent, appConfig);
