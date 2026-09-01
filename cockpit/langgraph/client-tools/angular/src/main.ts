// SPDX-License-Identifier: MIT
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';
import { appConfig } from './app/app.config';
import { ClientToolsComponent } from './app/client-tools.component';

void bootstrapWithCockpitHarness(ClientToolsComponent, appConfig).catch(console.error);
