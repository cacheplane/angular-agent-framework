// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { ApplicationConfig } from '@angular/core';
import { provideStreamResource } from '@cacheplane/stream-resource';
import { provideChat } from '@cacheplane/chat';
import { provideRender } from '@cacheplane/render';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideStreamResource({ apiUrl: environment.langGraphApiUrl }),
    provideChat({}),
    provideRender({}),
  ],
};
