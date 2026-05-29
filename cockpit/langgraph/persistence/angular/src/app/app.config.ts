// SPDX-License-Identifier: MIT
import { ApplicationConfig } from '@angular/core';
import { provideChat } from '@threadplane/chat';

export const appConfig: ApplicationConfig = {
  providers: [
    // The agent is provided at the component (PersistenceComponent) because
    // its onThreadId callback is per-instance — see persistence.component.ts.
    provideChat({}),
  ],
};
