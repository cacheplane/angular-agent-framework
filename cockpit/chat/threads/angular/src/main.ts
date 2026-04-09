// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { ThreadsComponent } from './app/threads.component';

bootstrapApplication(ThreadsComponent, appConfig).catch(console.error);
