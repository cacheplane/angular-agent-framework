// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { ApplicationConfig } from '@angular/core';
import { provideAgUiAgent } from '@cacheplane/ag-ui';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAgUiAgent({ url: environment.agUiUrl }),
  ],
};
