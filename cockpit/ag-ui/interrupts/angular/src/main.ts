// SPDX-License-Identifier: MIT
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { InterruptsComponent } from './app/interrupts.component';

bootstrapApplication(InterruptsComponent, appConfig).catch(console.error);
