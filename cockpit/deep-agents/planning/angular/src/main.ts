// SPDX-License-Identifier: MIT
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { PlanningComponent } from './app/planning.component';

bootstrapApplication(PlanningComponent, appConfig).catch(console.error);
