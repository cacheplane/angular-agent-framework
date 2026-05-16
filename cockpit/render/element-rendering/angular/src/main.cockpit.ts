// SPDX-License-Identifier: MIT
import { appConfig } from './app/app.config';
import { ElementRenderingComponent } from './app/element-rendering.component';
import { bootstrapWithCockpitHarness } from '@ngaf/cockpit-telemetry';

bootstrapWithCockpitHarness(ElementRenderingComponent, appConfig);
