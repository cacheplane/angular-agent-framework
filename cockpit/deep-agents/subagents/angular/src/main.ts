import { bootstrapApplication } from '@angular/platform-browser';
import { SubagentsComponent } from './app/subagents.component';
import { appConfig } from './app/app.config';

bootstrapApplication(SubagentsComponent, appConfig).catch((err) =>
  console.error(err)
);
