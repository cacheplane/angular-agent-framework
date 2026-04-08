// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { GenerativeUiComponent } from './app/generative-ui.component';

bootstrapApplication(GenerativeUiComponent, appConfig).catch(console.error);
