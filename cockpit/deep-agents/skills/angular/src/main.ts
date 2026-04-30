// SPDX-License-Identifier: MIT
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { SkillsComponent } from './app/skills.component';

bootstrapApplication(SkillsComponent, appConfig).catch(console.error);
