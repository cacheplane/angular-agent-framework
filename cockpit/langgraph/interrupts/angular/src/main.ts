// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app.config';
import { InterruptsAppComponent } from './app.component';

bootstrapApplication(InterruptsAppComponent, appConfig).catch(console.error);
