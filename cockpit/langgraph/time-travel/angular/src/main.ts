// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { TimeTravelComponent } from './app/time-travel.component';

bootstrapApplication(TimeTravelComponent, appConfig).catch(console.error);
