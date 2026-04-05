// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { ApplicationConfig } from '@angular/core';
import { provideStreamResource } from '@cacheplane/stream-resource';
import { provideChat } from '@cacheplane/chat';
import { provideRender } from '@cacheplane/render';

export const appConfig: ApplicationConfig = {
  providers: [
    provideStreamResource({
      apiUrl: 'http://localhost:2024',
    }),
    provideChat({}),
    provideRender({}),
  ],
};
