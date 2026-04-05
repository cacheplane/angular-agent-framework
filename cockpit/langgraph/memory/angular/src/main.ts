import { bootstrapApplication } from '@angular/platform-browser';
import { MemoryComponent } from './app/memory.component';
import { appConfig } from './app/app.config';

bootstrapApplication(MemoryComponent, appConfig).catch((err) =>
  console.error(err)
);
