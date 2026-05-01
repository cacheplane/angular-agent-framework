// SPDX-License-Identifier: MIT
import { ApplicationConfig } from '@angular/core';
import { provideAgent } from '@ngaf/langgraph';
import { provideChat } from '@ngaf/chat';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAgent({ apiUrl: environment.langGraphApiUrl }),
    provideChat({}),
  ],
};
