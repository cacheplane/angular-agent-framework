import { ApplicationConfig } from '@angular/core';

export const appConfig: ApplicationConfig = {
  providers: [
    // The agent is provided at the component (PersistenceComponent) because
    // its onThreadId callback is per-instance — see persistence.component.ts.
  ],
};
