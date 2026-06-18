// SPDX-License-Identifier: MIT
import { ApplicationConfig } from '@angular/core';
import { provideAgent } from '@threadplane/langgraph';
import { provideChat } from '@threadplane/chat';
import { environment } from '../environments/environment';
import { CLIENT_TOOLS_AGENT_REF } from './agent-ref';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAgent(CLIENT_TOOLS_AGENT_REF, {
      apiUrl: environment.langGraphApiUrl,
      assistantId: environment.clientToolsAssistantId,
    }),
    provideChat({}),
  ],
};
