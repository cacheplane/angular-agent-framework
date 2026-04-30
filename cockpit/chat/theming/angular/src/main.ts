// SPDX-License-Identifier: MIT
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { ThemingComponent } from './app/theming.component';

bootstrapApplication(ThemingComponent, appConfig).catch(console.error);
