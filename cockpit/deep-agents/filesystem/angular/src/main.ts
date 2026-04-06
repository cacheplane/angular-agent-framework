// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { FilesystemComponent } from './app/filesystem.component';

bootstrapApplication(FilesystemComponent, appConfig).catch(console.error);
