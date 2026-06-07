// SPDX-License-Identifier: MIT
import { ApplicationConfig } from '@angular/core';
import { provideAgent } from '@threadplane/ag-ui';
import { provideChat } from '@threadplane/chat';

export const appConfig: ApplicationConfig = {
  providers: [provideAgent({ url: '/agent' }), provideChat({})],
};
