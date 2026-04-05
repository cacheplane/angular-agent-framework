// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app.config';
import { DurableExecutionAppComponent } from './app.component';

bootstrapApplication(DurableExecutionAppComponent, appConfig).catch(console.error);
