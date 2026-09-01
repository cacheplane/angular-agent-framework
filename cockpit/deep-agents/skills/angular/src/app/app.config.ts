// SPDX-License-Identifier: MIT
import { ApplicationConfig } from '@angular/core';
import { provideAgent } from '@threadplane/langgraph';
import { provideChat } from '@threadplane/chat';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAgent({
      apiUrl: environment.langGraphApiUrl,
      assistantId: environment.streamingAssistantId,
    }),
    provideChat({}),
  ],
};
