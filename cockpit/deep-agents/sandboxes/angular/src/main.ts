// SPDX-License-Identifier: MIT
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { SandboxesComponent } from './app/sandboxes.component';

bootstrapApplication(SandboxesComponent, appConfig).catch(console.error);
