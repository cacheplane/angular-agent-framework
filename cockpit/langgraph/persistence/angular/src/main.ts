// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { PersistenceComponent } from './app/persistence.component';

bootstrapApplication(PersistenceComponent, appConfig).catch(console.error);
