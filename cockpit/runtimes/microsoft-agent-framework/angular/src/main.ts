// SPDX-License-Identifier: MIT
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { MicrosoftAgentFrameworkComponent } from './app/microsoft-agent-framework.component';

bootstrapApplication(MicrosoftAgentFrameworkComponent, appConfig).catch(console.error);
