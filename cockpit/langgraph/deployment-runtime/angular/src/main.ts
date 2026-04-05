import { bootstrapApplication } from '@angular/platform-browser';
import { DeploymentRuntimeComponent } from './app/deployment-runtime.component';
import { appConfig } from './app/app.config';

bootstrapApplication(DeploymentRuntimeComponent, appConfig).catch((err) =>
  console.error(err)
);
