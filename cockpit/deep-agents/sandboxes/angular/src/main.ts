import { bootstrapApplication } from '@angular/platform-browser';
import { SandboxesComponent } from './app/sandboxes.component';
import { appConfig } from './app/app.config';

bootstrapApplication(SandboxesComponent, appConfig).catch((err) =>
  console.error(err)
);
