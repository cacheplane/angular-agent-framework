// SPDX-License-Identifier: MIT
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
        // `SubAgentMiddleware` dispatches every child through one tool named
        // `task`, carrying `{description, subagent_type}`. That name is also the
        // SubagentTracker's default, so this line changes nothing at runtime —
        // it is here to say out loud which tool call means "a child agent
        // started". Set it when your dispatch tool is named something else;
        // overriding it with a name the graph never calls is what turns the
        // cards back into generic tool chips.
        subagentToolNames: ['task'],
      };
    }),
    provideChat({}),
  ],
};
