import { ApplicationConfig } from '@angular/core';
import { provideChat } from '@threadplane/chat';
import { injectCockpitRuntimeConnection } from '@threadplane/cockpit-telemetry';
import {
  LANGGRAPH_CLIENT_OPTIONS,
  LANGGRAPH_THREADS_CONFIG,
} from '@threadplane/langgraph';

export const appConfig: ApplicationConfig = {
  providers: [
    // The agent is provided at the component (ThreadsComponent) because its
    // threadId + onThreadId config is per-instance — see threads.component.ts.
    provideChat({}),
    // The adapter expects metadata.title; the cap's generate_title
    // graph node writes there. No per-cap key override needed.
    {
      provide: LANGGRAPH_THREADS_CONFIG,
      useFactory: () => {
        const connection = injectCockpitRuntimeConnection();
        if (connection.adapter !== 'langgraph') {
          throw new Error('incompatible runtime');
        }
        return { apiUrl: connection.apiUrl };
      },
    },
    {
      provide: LANGGRAPH_CLIENT_OPTIONS,
      useFactory: () => {
        const connection = injectCockpitRuntimeConnection();
        if (connection.adapter !== 'langgraph') {
          throw new Error('incompatible runtime');
        }
        return connection.clientOptions;
      },
    },
  ],
};
