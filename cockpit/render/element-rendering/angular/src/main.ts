// SPDX-License-Identifier: MIT
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { ElementRenderingComponent } from './app/element-rendering.component';

bootstrapApplication(ElementRenderingComponent, appConfig).catch(console.error);
