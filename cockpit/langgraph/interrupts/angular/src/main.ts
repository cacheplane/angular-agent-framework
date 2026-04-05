import { bootstrapApplication } from '@angular/platform-browser';
import { InterruptsComponent } from './app/interrupts.component';
import { appConfig } from './app/app.config';

bootstrapApplication(InterruptsComponent, appConfig).catch((err) =>
  console.error(err)
);
