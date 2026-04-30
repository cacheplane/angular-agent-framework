// SPDX-License-Identifier: MIT
import { ApplicationConfig } from '@angular/core';
import { provideAgent } from '@cacheplane/langgraph';
import { provideChat } from '@cacheplane/chat';
import { provideRender } from '@cacheplane/render';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAgent({ apiUrl: environment.langGraphApiUrl }),
    provideChat({}),
    provideRender({}),
  ],
};
