// SPDX-License-Identifier: MIT
import { appConfig } from './app/app.config';
import { A2uiComponent } from './app/a2ui.component';
import { bootstrapWithCockpitHarness } from '@ngaf/cockpit-telemetry';

bootstrapWithCockpitHarness(A2uiComponent, appConfig);
