// SPDX-License-Identifier: MIT
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { ToolCallsComponent } from './app/tool-calls.component';

bootstrapApplication(ToolCallsComponent, appConfig).catch(console.error);
