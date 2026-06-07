// SPDX-License-Identifier: MIT
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { JsonRenderComponent } from './app/json-render.component';

bootstrapApplication(JsonRenderComponent, appConfig).catch(console.error);
