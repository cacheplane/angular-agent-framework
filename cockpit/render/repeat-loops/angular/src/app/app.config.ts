// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { ApplicationConfig } from '@angular/core';
import { provideRender } from '@cacheplane/render';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRender({}),
  ],
};
