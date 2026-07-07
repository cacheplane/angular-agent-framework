// SPDX-License-Identifier: MIT
import {
  ApplicationConfig,
  inject,
  provideBrowserGlobalErrorListeners,
  provideEnvironmentInitializer,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideThreadplaneTelemetry } from '@threadplane/telemetry/browser';
import { LANGGRAPH_THREADS_CONFIG, LANGGRAPH_CLIENT_OPTIONS } from '@threadplane/langgraph';
import { provideChat } from '@threadplane/chat';
import { e2eClientOptions } from './shell/e2e-overrides';
import { ItineraryStore } from './itinerary-store';
import { GoogleMapsLoader } from './google-maps-loader';
import { routes } from './app.routes';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
    provideThreadplaneTelemetry(environment.telemetry),
    // Configure the shared LangGraphThreadsAdapter.
    {
      provide: LANGGRAPH_THREADS_CONFIG,
      useValue: { apiUrl: environment.langGraphApiUrl },
    },
    // Single source of truth for the SDK client retry budget — both the agent
    // transport and the threads adapter read this. Production: e2eClientOptions()
    // returns undefined → SDK default. Under e2e: the THREADPLANE_E2E_MAX_RETRIES
    // localStorage flag → fail fast. useFactory runs at injection time (post-
    // bootstrap), so the flag is readable.
    { provide: LANGGRAPH_CLIENT_OPTIONS, useFactory: () => e2eClientOptions() },
    // Optional license token, populated from environment.license. When
    // unset (the default in main), @threadplane/chat runs in advisory mode and
    // logs a console.warn once. A smoke-test session can drop a real
    // token into environment.ts to exercise the verify path.
    provideChat({
      license: environment.license,
    }),
    // App-wide singleton so DemoShell, the itinerary panel, and the map cockpit
    // all read/write ONE working copy of the itinerary. Provided at root (not at
    // the component) so routed children share the same instance.
    ItineraryStore,
    // Eagerly kick off the Google Maps JS API load at bootstrap so the map
    // canvas can mount as soon as App mode turns on (no per-component wait).
    provideEnvironmentInitializer(() => inject(GoogleMapsLoader).ensureLoaded()),
  ],
};
