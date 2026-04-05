import { bootstrapApplication } from '@angular/platform-browser';
import { PersistenceComponent } from './app/persistence.component';
import { appConfig } from './app/app.config';

bootstrapApplication(PersistenceComponent, appConfig).catch((err) =>
  console.error(err)
);
