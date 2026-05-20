// SPDX-License-Identifier: MIT
import { ApplicationConfig } from '@angular/core';
import { provideAgent, LANGGRAPH_THREADS_CONFIG } from '@ngaf/langgraph';
import { provideChat } from '@ngaf/chat';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAgent({ apiUrl: environment.langGraphApiUrl }),
    provideChat({}),
    // c-threads' Python graph writes the LLM-generated title to
    // metadata.thread_title (per spec 2026-05-19-llm-generated-labels-design).
    {
      provide: LANGGRAPH_THREADS_CONFIG,
      useValue: {
        apiUrl: environment.langGraphApiUrl,
        titleMetadataKey: 'thread_title',
      },
    },
  ],
};
