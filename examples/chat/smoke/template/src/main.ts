import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

Promise.all([
  bootstrapApplication(App, appConfig),
  import('./compatibility-probe').then(({ bootstrapCompatibilityProbe }) =>
    bootstrapCompatibilityProbe()
  ),
]).catch((err) => console.error(err));
