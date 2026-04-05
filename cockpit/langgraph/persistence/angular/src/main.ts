// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app.config';
import { PersistenceAppComponent } from './app.component';

bootstrapApplication(PersistenceAppComponent, appConfig).catch(console.error);
