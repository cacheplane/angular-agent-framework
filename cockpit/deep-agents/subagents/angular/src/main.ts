// SPDX-License-Identifier: MIT
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';
import { appConfig } from './app/app.config';
import { SubagentsComponent } from './app/subagents.component';

void bootstrapWithCockpitHarness(SubagentsComponent, appConfig).catch(console.error);
