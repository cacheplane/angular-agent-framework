// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { DeploymentRuntimeComponent } from './app/deployment-runtime.component';

bootstrapApplication(DeploymentRuntimeComponent, appConfig).catch(console.error);
