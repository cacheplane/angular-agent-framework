// SPDX-License-Identifier: MIT
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { GenerativeUiComponent } from './app/generative-ui.component';

bootstrapApplication(GenerativeUiComponent, appConfig).catch(console.error);
