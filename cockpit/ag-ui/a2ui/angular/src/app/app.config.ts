// SPDX-License-Identifier: MIT
import { injectCockpitRuntimeConnection } from '@threadplane/cockpit-telemetry';
import { ApplicationConfig } from '@angular/core';
import { provideAgent } from '@threadplane/ag-ui';
import { provideChat } from '@threadplane/chat';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAgent(() => {
      const connection = injectCockpitRuntimeConnection();
      if (connection.adapter !== 'ag-ui') {
        throw new Error('incompatible runtime');
      }
      return {
        url: connection.url,
      };
    }),
    provideChat({}),
  ],
};
