// SPDX-License-Identifier: MIT
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { StreamingComponent } from './app/streaming.component';

bootstrapApplication(StreamingComponent, appConfig).catch(console.error);
