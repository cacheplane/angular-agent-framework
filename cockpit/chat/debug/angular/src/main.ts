// SPDX-License-Identifier: MIT
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { DebugPageComponent } from './app/debug.component';

bootstrapApplication(DebugPageComponent, appConfig).catch(console.error);
