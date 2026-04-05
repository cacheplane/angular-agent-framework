// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app.config';
import { SubgraphsAppComponent } from './app.component';

bootstrapApplication(SubgraphsAppComponent, appConfig).catch(console.error);
