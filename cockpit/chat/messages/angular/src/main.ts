// SPDX-License-Identifier: MIT
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';
import { appConfig } from './app/app.config';
import { MessagesComponent } from './app/messages.component';

void bootstrapWithCockpitHarness(MessagesComponent, appConfig).catch(console.error);
