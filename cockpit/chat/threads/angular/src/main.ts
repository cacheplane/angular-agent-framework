// SPDX-License-Identifier: MIT
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { ThreadsComponent } from './app/threads.component';

bootstrapApplication(ThreadsComponent, appConfig).catch(console.error);
