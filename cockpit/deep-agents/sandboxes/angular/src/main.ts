// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { SandboxesComponent } from './app/sandboxes.component';

bootstrapApplication(SandboxesComponent, appConfig).catch(console.error);
