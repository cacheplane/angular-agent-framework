import { bootstrapApplication } from '@angular/platform-browser';
import { SubgraphsComponent } from './app/subgraphs.component';
import { appConfig } from './app/app.config';

bootstrapApplication(SubgraphsComponent, appConfig).catch((err) =>
  console.error(err)
);
