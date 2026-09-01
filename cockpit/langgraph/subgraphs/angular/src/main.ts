// SPDX-License-Identifier: MIT
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';
import { appConfig } from './app/app.config';
import { SubgraphsComponent } from './app/subgraphs.component';

void bootstrapWithCockpitHarness(SubgraphsComponent, appConfig).catch(console.error);
