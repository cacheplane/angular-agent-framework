// SPDX-License-Identifier: MIT
import { appConfig } from './app/app.config';
import { SkillsComponent } from './app/skills.component';
import { bootstrapWithCockpitHarness } from '@ngaf/cockpit-telemetry';

bootstrapWithCockpitHarness(SkillsComponent, appConfig);
