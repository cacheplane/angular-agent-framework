import { injectCockpitRuntimeConnection } from '@threadplane/cockpit-telemetry';
import { ApplicationConfig } from '@angular/core';
import { provideAgent } from '@threadplane/langgraph';
import { provideChat } from '@threadplane/chat';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAgent(() => {
      const connection = injectCockpitRuntimeConnection();
      if (connection.adapter !== 'langgraph') {
        throw new Error('incompatible runtime');
      }
      return {
        apiUrl: connection.apiUrl,
        assistantId: connection.assistantId,
        clientOptions: connection.clientOptions,
        // Treat `task` tool calls as subagent dispatches: the SubagentTracker
        // registers them and matches the child subgraph's tools:<id> namespace,
        // so agent.subagents() populates and the inline subagent card renders.
        subagentToolNames: ['task'],
      };
    }),
    provideChat({}),
  ],
};
