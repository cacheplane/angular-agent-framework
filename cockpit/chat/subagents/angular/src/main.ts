// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { SubagentsComponent } from './app/subagents.component';

bootstrapApplication(SubagentsComponent, appConfig).catch(console.error);
