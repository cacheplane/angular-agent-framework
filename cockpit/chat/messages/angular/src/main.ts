// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { MessagesComponent } from './app/messages.component';

bootstrapApplication(MessagesComponent, appConfig).catch(console.error);
