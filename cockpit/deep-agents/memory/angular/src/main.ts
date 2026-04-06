// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { MemoryComponent } from './app/memory.component';

bootstrapApplication(MemoryComponent, appConfig).catch(console.error);
