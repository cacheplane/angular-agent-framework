// SPDX-License-Identifier: MIT
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { SpecRenderingComponent } from './app/spec-rendering.component';

bootstrapApplication(SpecRenderingComponent, appConfig).catch(console.error);
