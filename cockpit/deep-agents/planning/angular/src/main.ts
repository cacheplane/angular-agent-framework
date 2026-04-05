import { bootstrapApplication } from '@angular/platform-browser';
import { PlanningComponent } from './app/planning.component';
import { appConfig } from './app/app.config';

bootstrapApplication(PlanningComponent, appConfig).catch((err) =>
  console.error(err)
);
