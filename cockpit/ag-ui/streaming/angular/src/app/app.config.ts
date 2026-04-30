// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { ApplicationConfig } from '@angular/core';
import { provideFakeAgUiAgent } from '@cacheplane/ag-ui';

export const appConfig: ApplicationConfig = {
  providers: [
    provideFakeAgUiAgent({
      tokens: [
        'This', ' is', ' the', ' AG-UI', ' streaming', ' demo.',
        ' Messages', ' are', ' generated', ' in-process', ' by', ' a', ' FakeAgent',
        ' that', ' emits', ' canned', ' AG-UI', ' events.',
        ' Swap', ' to', ' provideAgUiAgent({ url })', ' to', ' connect', ' a', ' real', ' backend.',
      ],
      delayMs: 50,
    }),
  ],
};
