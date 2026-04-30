// SPDX-License-Identifier: MIT
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { RegistryComponent } from './app/registry.component';

bootstrapApplication(RegistryComponent, appConfig).catch(console.error);
