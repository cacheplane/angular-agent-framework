// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app.config';
import { MemoryAppComponent } from './app.component';

bootstrapApplication(MemoryAppComponent, appConfig).catch(console.error);
