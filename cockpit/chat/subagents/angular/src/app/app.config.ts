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
      // Treat `task` tool calls as subagent dispatches: the SubagentTracker
      // registers them and matches the child subgraph's tools:<id> namespace,
      // so agent.subagents() populates and the inline subagent card renders.
      subagentToolNames: ['task'],
    }),
    provideChat({}),
  ],
};
