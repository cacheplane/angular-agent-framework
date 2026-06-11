// SPDX-License-Identifier: MIT
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideThreadplaneTelemetry } from '@threadplane/telemetry/browser';
import { provideChat } from '@threadplane/chat';
import { provideAgent } from '@threadplane/ag-ui';
import { environment } from '../environments/environment';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideThreadplaneTelemetry(environment.telemetry),
    provideAgent({ url: environment.agentUrl }),
    provideChat({ license: environment.license }),
  ],
};
