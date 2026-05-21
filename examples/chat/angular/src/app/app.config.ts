// SPDX-License-Identifier: MIT
import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideNgafTelemetry } from '@ngaf/telemetry/browser';
import { LANGGRAPH_THREADS_CONFIG } from '@ngaf/langgraph';
import { provideChat } from '@ngaf/chat';
import { routes } from './app.routes';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
    provideNgafTelemetry(environment.telemetry),
    // Configure the shared LangGraphThreadsAdapter.
    {
      provide: LANGGRAPH_THREADS_CONFIG,
      useValue: { apiUrl: environment.langGraphApiUrl },
    },
    // Optional license token, populated from environment.license. When
    // unset (the default in main), @ngaf/chat runs in advisory mode and
    // logs a console.warn once. A smoke-test session can drop a real
    // token into environment.ts to exercise the verify path.
    provideChat({
      license: environment.license,
    }),
  ],
};
