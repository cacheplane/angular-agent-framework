// SPDX-License-Identifier: MIT
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';
import { appConfig } from './app/app.config';
import { PersistenceComponent } from './app/persistence.component';

void bootstrapWithCockpitHarness(PersistenceComponent, appConfig).catch(console.error);
