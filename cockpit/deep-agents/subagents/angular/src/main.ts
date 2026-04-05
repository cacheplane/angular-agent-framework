// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app.config';
import { SubagentsAppComponent } from './app.component';

bootstrapApplication(SubagentsAppComponent, appConfig).catch(console.error);
