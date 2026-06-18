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
import { ItineraryStore } from './itinerary-store';
import { ITINERARY_AGENT } from './client-tools';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideThreadplaneTelemetry(environment.telemetry),
    // Typed agent provider: flows ItineraryState through DI so every
    // injectAgent(ITINERARY_AGENT) call returns AgUiAgent<ItineraryState>.
    provideAgent(ITINERARY_AGENT, { url: environment.agentUrl }),
    provideChat({ license: environment.license }),
    // The frontend-owned itinerary is a single shared instance: the panel,
    // the App component, and the client-tool ask component all inject it, so
    // user edits and agent writes hit the same signals and render live.
    ItineraryStore,
  ],
};
