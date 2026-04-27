// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { StreamingComponent } from './app/streaming.component';

bootstrapApplication(StreamingComponent, appConfig).catch(console.error);
