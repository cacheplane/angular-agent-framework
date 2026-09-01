// SPDX-License-Identifier: MIT
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';
import { appConfig } from './app/app.config';
import { ThemingComponent } from './app/theming.component';

void bootstrapWithCockpitHarness(ThemingComponent, appConfig).catch(console.error);
