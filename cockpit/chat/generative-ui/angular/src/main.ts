// SPDX-License-Identifier: MIT
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';
import { appConfig } from './app/app.config';
import { GenerativeUiComponent } from './app/generative-ui.component';

void bootstrapWithCockpitHarness(GenerativeUiComponent, appConfig).catch(console.error);
