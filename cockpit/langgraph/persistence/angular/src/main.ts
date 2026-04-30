// SPDX-License-Identifier: MIT
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { PersistenceComponent } from './app/persistence.component';

bootstrapApplication(PersistenceComponent, appConfig).catch(console.error);
