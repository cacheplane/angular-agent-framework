import { bootstrapApplication } from '@angular/platform-browser';
import { TimeTravelComponent } from './app/time-travel.component';
import { appConfig } from './app/app.config';

bootstrapApplication(TimeTravelComponent, appConfig).catch((err) =>
  console.error(err)
);
