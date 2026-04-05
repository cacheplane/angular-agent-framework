import { bootstrapApplication } from '@angular/platform-browser';
import { FilesystemComponent } from './app/filesystem.component';
import { appConfig } from './app/app.config';

bootstrapApplication(FilesystemComponent, appConfig).catch((err) =>
  console.error(err)
);
