// SPDX-License-Identifier: MIT
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { MemoryComponent } from './app/memory.component';

bootstrapApplication(MemoryComponent, appConfig).catch(console.error);
