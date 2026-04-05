// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app.config';
import { SkillsAppComponent } from './app.component';

bootstrapApplication(SkillsAppComponent, appConfig).catch(console.error);
