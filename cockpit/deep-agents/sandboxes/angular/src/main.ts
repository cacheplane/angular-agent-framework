// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app.config';
import { SandboxesAppComponent } from './app.component';

bootstrapApplication(SandboxesAppComponent, appConfig).catch(console.error);
