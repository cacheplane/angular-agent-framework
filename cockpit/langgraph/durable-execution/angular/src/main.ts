// SPDX-License-Identifier: MIT
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { DurableExecutionComponent } from './app/durable-execution.component';

bootstrapApplication(DurableExecutionComponent, appConfig).catch(console.error);
