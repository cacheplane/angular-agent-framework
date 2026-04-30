// SPDX-License-Identifier: MIT
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { FilesystemComponent } from './app/filesystem.component';

bootstrapApplication(FilesystemComponent, appConfig).catch(console.error);
