// SPDX-License-Identifier: MIT
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { SubgraphsComponent } from './app/subgraphs.component';

bootstrapApplication(SubgraphsComponent, appConfig).catch(console.error);
