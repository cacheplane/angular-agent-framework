// SPDX-License-Identifier: MIT
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { TimeTravelComponent } from './app/time-travel.component';

bootstrapApplication(TimeTravelComponent, appConfig).catch(console.error);
