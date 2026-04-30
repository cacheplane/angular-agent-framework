// SPDX-License-Identifier: MIT
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { StateManagementComponent } from './app/state-management.component';

bootstrapApplication(StateManagementComponent, appConfig).catch(console.error);
