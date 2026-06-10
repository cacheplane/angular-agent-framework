// SPDX-License-Identifier: MIT
import { appConfig } from './app/app.config';
import { ClientToolsComponent } from './app/client-tools.component';
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';

bootstrapWithCockpitHarness(ClientToolsComponent, appConfig);
