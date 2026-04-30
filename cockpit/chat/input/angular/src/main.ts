// SPDX-License-Identifier: MIT
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { InputComponent } from './app/input.component';

bootstrapApplication(InputComponent, appConfig).catch(console.error);
