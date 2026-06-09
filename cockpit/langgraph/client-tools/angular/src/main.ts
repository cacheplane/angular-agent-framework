// SPDX-License-Identifier: MIT
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { ClientToolsComponent } from './app/client-tools.component';

bootstrapApplication(ClientToolsComponent, appConfig).catch(console.error);
