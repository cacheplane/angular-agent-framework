import { ApplicationConfig } from '@angular/core';
import { provideRender } from '@threadplane/render';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRender({}),
  ],
};
