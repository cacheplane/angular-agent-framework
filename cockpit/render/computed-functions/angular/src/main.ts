// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { ComputedFunctionsComponent } from './app/computed-functions.component';

bootstrapApplication(ComputedFunctionsComponent, appConfig).catch(console.error);
