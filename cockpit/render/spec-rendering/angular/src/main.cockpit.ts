// SPDX-License-Identifier: MIT
import { appConfig } from './app/app.config';
import { SpecRenderingComponent } from './app/spec-rendering.component';
import { bootstrapWithCockpitHarness } from '@ngaf/cockpit-telemetry';

bootstrapWithCockpitHarness(SpecRenderingComponent, appConfig);
