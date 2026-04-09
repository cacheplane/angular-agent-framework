// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { InputComponent } from './app/input.component';

bootstrapApplication(InputComponent, appConfig).catch(console.error);
