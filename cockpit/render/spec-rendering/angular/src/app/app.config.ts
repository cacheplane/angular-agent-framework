// SPDX-License-Identifier: MIT
import { ApplicationConfig } from '@angular/core';
import { provideRender } from '@ngaf/render';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRender({}),
  ],
};
