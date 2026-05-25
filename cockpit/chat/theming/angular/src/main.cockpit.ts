// SPDX-License-Identifier: MIT
import { appConfig } from './app/app.config';
import { ThemingComponent } from './app/theming.component';
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';

bootstrapWithCockpitHarness(ThemingComponent, appConfig);
