// SPDX-License-Identifier: MIT
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';
import { appConfig } from './app/app.config';
import { JsonRenderComponent } from './app/json-render.component';

void bootstrapWithCockpitHarness(JsonRenderComponent, appConfig).catch(console.error);
