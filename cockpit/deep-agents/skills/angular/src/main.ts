// SPDX-License-Identifier: MIT
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';
import { appConfig } from './app/app.config';
import { SkillsComponent } from './app/skills.component';

void bootstrapWithCockpitHarness(SkillsComponent, appConfig).catch(console.error);
