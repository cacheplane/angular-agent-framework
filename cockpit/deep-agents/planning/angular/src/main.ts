// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app.config';
import { PlanningAppComponent } from './app.component';

bootstrapApplication(PlanningAppComponent, appConfig).catch(console.error);
