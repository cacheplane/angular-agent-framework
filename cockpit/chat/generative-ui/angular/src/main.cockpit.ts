// SPDX-License-Identifier: MIT
import { appConfig } from './app/app.config';
import { GenerativeUiComponent } from './app/generative-ui.component';
import { bootstrapWithCockpitHarness } from '@ngaf/cockpit-telemetry';

bootstrapWithCockpitHarness(GenerativeUiComponent, appConfig);
