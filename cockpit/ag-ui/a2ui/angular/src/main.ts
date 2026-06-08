// SPDX-License-Identifier: MIT
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { A2uiComponent } from './app/a2ui.component';

bootstrapApplication(A2uiComponent, appConfig).catch(console.error);
