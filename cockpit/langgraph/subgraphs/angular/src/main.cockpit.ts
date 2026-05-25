// SPDX-License-Identifier: MIT
import { appConfig } from './app/app.config';
import { SubgraphsComponent } from './app/subgraphs.component';
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';

bootstrapWithCockpitHarness(SubgraphsComponent, appConfig);
