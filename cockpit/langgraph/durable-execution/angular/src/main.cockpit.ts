// SPDX-License-Identifier: MIT
import { appConfig } from './app/app.config';
import { DurableExecutionComponent } from './app/durable-execution.component';
import { bootstrapWithCockpitHarness } from '@ngaf/cockpit-telemetry';

bootstrapWithCockpitHarness(DurableExecutionComponent, appConfig);
