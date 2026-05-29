// SPDX-License-Identifier: MIT
import { ApplicationConfig } from '@angular/core';
import { LANGGRAPH_THREADS_CONFIG } from '@threadplane/langgraph';
import { provideChat } from '@threadplane/chat';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    // The agent is provided at the component (ThreadsComponent) because its
    // threadId + onThreadId config is per-instance — see threads.component.ts.
    provideChat({}),
    // The adapter expects metadata.title; the cap's generate_title
    // graph node writes there. No per-cap key override needed.
    {
      provide: LANGGRAPH_THREADS_CONFIG,
      useValue: { apiUrl: environment.langGraphApiUrl },
    },
  ],
};
