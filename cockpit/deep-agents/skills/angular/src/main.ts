// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { SkillsComponent } from './app/skills.component';

bootstrapApplication(SkillsComponent, appConfig).catch(console.error);
