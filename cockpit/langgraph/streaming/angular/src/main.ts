// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app.config';
import { StreamingAppComponent } from './app.component';

bootstrapApplication(StreamingAppComponent, appConfig).catch(console.error);
