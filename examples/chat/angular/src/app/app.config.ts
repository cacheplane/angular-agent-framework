// SPDX-License-Identifier: MIT
import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideThreadplaneTelemetry } from '@threadplane/telemetry/browser';
import { LANGGRAPH_THREADS_CONFIG } from '@threadplane/langgraph';
import { provideChat } from '@threadplane/chat';
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
    // Optional license token, populated from environment.license. When
    // unset (the default in main), @threadplane/chat runs in advisory mode and
    // logs a console.warn once. A smoke-test session can drop a real
    // token into environment.ts to exercise the verify path.
    provideChat({
      license: environment.license,
    }),
  ],
};
