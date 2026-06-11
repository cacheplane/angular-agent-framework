// SPDX-License-Identifier: MIT
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideThreadplaneTelemetry } from '@threadplane/telemetry/browser';
import { provideChat } from '@threadplane/chat';
import { provideAgent } from '@threadplane/ag-ui';
import { environment } from '../environments/environment';
import { ItineraryStore } from './itinerary-store';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideThreadplaneTelemetry(environment.telemetry),
    provideAgent({ url: environment.agentUrl }),
    provideChat({ license: environment.license }),
    // The frontend-owned itinerary is a single shared instance: the panel,
    // the App component, and the client-tool ask component all inject it, so
    // user edits and agent writes hit the same signals and render live.
    ItineraryStore,
  ],
};
