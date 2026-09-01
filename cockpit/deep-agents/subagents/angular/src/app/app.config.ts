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
      // `SubAgentMiddleware` dispatches every child through one tool named
      // `task`, carrying `{description, subagent_type}`. That name is also the
      // SubagentTracker's default, so this line changes nothing at runtime —
      // it is here to say out loud which tool call means "a child agent
      // started". Set it when your dispatch tool is named something else;
      // overriding it with a name the graph never calls is what turns the
      // cards back into generic tool chips.
      subagentToolNames: ['task'],
    }),
    provideChat({}),
  ],
};
