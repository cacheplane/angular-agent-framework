// SPDX-License-Identifier: MIT
import { ClientToolsComponent } from './app/client-tools.component';
import { appConfig } from './app/app.config';
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';

bootstrapWithCockpitHarness(ClientToolsComponent, appConfig);
