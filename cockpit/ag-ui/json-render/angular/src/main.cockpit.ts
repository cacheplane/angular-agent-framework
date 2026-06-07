// SPDX-License-Identifier: MIT
import { appConfig } from './app/app.config';
import { JsonRenderComponent } from './app/json-render.component';
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';

bootstrapWithCockpitHarness(JsonRenderComponent, appConfig);
