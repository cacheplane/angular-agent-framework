// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { TimelineComponent } from './app/timeline.component';

bootstrapApplication(TimelineComponent, appConfig).catch(console.error);
