// SPDX-License-Identifier: MIT
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { TimelineComponent } from './app/timeline.component';

bootstrapApplication(TimelineComponent, appConfig).catch(console.error);
