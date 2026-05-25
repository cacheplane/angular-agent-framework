// SPDX-License-Identifier: MIT
import { ApplicationConfig } from '@angular/core';
import { provideAgent, LANGGRAPH_THREADS_CONFIG } from '@threadplane/langgraph';
import { provideChat } from '@threadplane/chat';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAgent({ apiUrl: environment.langGraphApiUrl }),
    provideChat({}),
    // The adapter expects metadata.title; the cap's generate_title
    // graph node writes there. No per-cap key override needed.
    {
      provide: LANGGRAPH_THREADS_CONFIG,
      useValue: { apiUrl: environment.langGraphApiUrl },
    },
  ],
};
