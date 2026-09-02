// SPDX-License-Identifier: MIT
import { injectCockpitRuntimeConnection } from '@threadplane/cockpit-telemetry';
import { ApplicationConfig } from '@angular/core';
import { provideAgent } from '@threadplane/langgraph';
import { provideChat } from '@threadplane/chat';
import { CLIENT_TOOLS_AGENT_REF } from './agent-ref';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAgent(CLIENT_TOOLS_AGENT_REF, () => {
      const connection = injectCockpitRuntimeConnection();
      if (connection.adapter !== 'langgraph') {
        throw new Error('incompatible runtime');
      }
      return {
        apiUrl: connection.apiUrl,
        assistantId: connection.assistantId,
        clientOptions: connection.clientOptions,
      };
    }),
    provideChat({}),
  ],
};
