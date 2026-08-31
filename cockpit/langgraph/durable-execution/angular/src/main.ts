// SPDX-License-Identifier: MIT
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';
import { appConfig } from './app/app.config';
import { DurableExecutionComponent } from './app/durable-execution.component';

void bootstrapWithCockpitHarness(DurableExecutionComponent, appConfig).catch(console.error);
