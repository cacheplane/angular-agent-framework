// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { RegistryComponent } from './app/registry.component';

bootstrapApplication(RegistryComponent, appConfig).catch(console.error);
