import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { bootstrapCompatibilityProbe } from './compatibility-probe';

Promise.all([
  bootstrapApplication(App, appConfig),
  bootstrapCompatibilityProbe(),
]).catch((err) => console.error(err));
