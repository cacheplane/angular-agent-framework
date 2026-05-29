// SPDX-License-Identifier: MIT
import { ApplicationConfig } from '@angular/core';
import { provideFakeAgent } from '@threadplane/ag-ui';

export const appConfig: ApplicationConfig = {
  providers: [
    provideFakeAgent({
      tokens: [
        'This', ' is', ' the', ' AG-UI', ' streaming', ' demo.',
        ' Messages', ' are', ' generated', ' in-process', ' by', ' a', ' FakeAgent',
        ' that', ' emits', ' canned', ' AG-UI', ' events.',
        ' Swap', ' to', ' provideAgent({ url })', ' to', ' connect', ' a', ' real', ' backend.',
      ],
      delayMs: 50,
    }),
  ],
};
