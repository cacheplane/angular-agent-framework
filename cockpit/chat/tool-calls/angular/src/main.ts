// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { ToolCallsComponent } from './app/tool-calls.component';

bootstrapApplication(ToolCallsComponent, appConfig).catch(console.error);
