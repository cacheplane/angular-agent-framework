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
    // Thread persistence intentionally omitted: the itinerary AG-UI server
    // uses an in-process MemorySaver (examples/ag-ui/python/src/server.py)
    // that is wiped on every server restart, so restoring by threadId would
    // not return prior conversation history. Additionally, the AG-UI protocol
    // sends the full client-side message list on every runAgent() call, meaning
    // the HttpAgent constructs each turn from what the client already holds —
    // there is no server-side "snapshot replay on connect" for this transport.
    // Standalone LangGraph apps backed by a durable checkpointer use
    // injectThreadRouting (see examples/chat); for AG-UI to adopt it the server
    // would need a persistent store (e.g. SqliteSaver / PostgresSaver) so
    // reloading a prior threadId actually returns prior history.
    //
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
