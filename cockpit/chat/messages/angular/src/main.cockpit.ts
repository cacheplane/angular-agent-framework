// SPDX-License-Identifier: MIT
import { appConfig } from './app/app.config';
import { MessagesComponent } from './app/messages.component';
import { bootstrapWithCockpitHarness } from '@ngaf/cockpit-telemetry';

bootstrapWithCockpitHarness(MessagesComponent, appConfig);
