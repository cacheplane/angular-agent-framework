// SPDX-License-Identifier: MIT
import { appConfig } from './app/app.config';
import { PersistenceComponent } from './app/persistence.component';
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';

bootstrapWithCockpitHarness(PersistenceComponent, appConfig);
