import { bootstrapApplication } from '@angular/platform-browser';
import { DurableExecutionComponent } from './app/durable-execution.component';
import { appConfig } from './app/app.config';

bootstrapApplication(DurableExecutionComponent, appConfig).catch((err) =>
  console.error(err)
);
