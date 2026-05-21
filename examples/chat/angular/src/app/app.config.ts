// SPDX-License-Identifier: MIT
import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideNgafTelemetry } from '@ngaf/telemetry/browser';
import { LANGGRAPH_THREADS_CONFIG } from '@ngaf/langgraph';
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
  ],
};
