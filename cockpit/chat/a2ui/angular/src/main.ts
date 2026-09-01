// SPDX-License-Identifier: MIT
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';
import { appConfig } from './app/app.config';
import { A2uiComponent } from './app/a2ui.component';

void bootstrapWithCockpitHarness(A2uiComponent, appConfig).catch(console.error);
