// SPDX-License-Identifier: MIT
import { ApplicationConfig } from '@angular/core';
import { provideAgent } from '@threadplane/langgraph';
import { provideChat } from '@threadplane/chat';
import { environment } from '../environments/environment';
import { MESSAGES_AGENT } from './agent-ref';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAgent(MESSAGES_AGENT, {
      apiUrl: environment.langGraphApiUrl,
      assistantId: environment.streamingAssistantId,
    }),
    provideChat({}),
  ],
};
