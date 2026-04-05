import { bootstrapApplication } from '@angular/platform-browser';
import { StreamingComponent } from './app/streaming.component';
import { appConfig } from './app/app.config';

bootstrapApplication(StreamingComponent, appConfig).catch((err) =>
  console.error(err)
);
