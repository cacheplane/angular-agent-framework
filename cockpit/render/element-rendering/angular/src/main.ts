// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { ElementRenderingComponent } from './app/element-rendering.component';

bootstrapApplication(ElementRenderingComponent, appConfig).catch(console.error);
