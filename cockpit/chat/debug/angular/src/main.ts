// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { DebugPageComponent } from './app/debug.component';

bootstrapApplication(DebugPageComponent, appConfig).catch(console.error);
