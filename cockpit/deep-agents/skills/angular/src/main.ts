import { bootstrapApplication } from '@angular/platform-browser';
import { SkillsComponent } from './app/skills.component';
import { appConfig } from './app/app.config';

bootstrapApplication(SkillsComponent, appConfig).catch((err) =>
  console.error(err)
);
