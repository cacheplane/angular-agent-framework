// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { A2uiComponent } from './app/a2ui.component';

bootstrapApplication(A2uiComponent, appConfig).catch(console.error);
