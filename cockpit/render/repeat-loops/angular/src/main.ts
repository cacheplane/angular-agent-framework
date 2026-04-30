// SPDX-License-Identifier: MIT
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { RepeatLoopsComponent } from './app/repeat-loops.component';

bootstrapApplication(RepeatLoopsComponent, appConfig).catch(console.error);
