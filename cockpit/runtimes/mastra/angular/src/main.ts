// SPDX-License-Identifier: MIT
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { MastraComponent } from './app/mastra.component';

bootstrapApplication(MastraComponent, appConfig).catch(console.error);
