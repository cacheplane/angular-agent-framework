// SPDX-License-Identifier: MIT
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { ToolViewsComponent } from './app/tool-views.component';

bootstrapApplication(ToolViewsComponent, appConfig).catch(console.error);
