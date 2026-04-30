// SPDX-License-Identifier: MIT
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { SubagentsComponent } from './app/subagents.component';

bootstrapApplication(SubagentsComponent, appConfig).catch(console.error);
