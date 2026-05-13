// SPDX-License-Identifier: MIT
import { bootstrapApplication } from '@angular/platform-browser';
import { installEmbeddedTheme } from '@ngaf/example-layouts';
import { appConfig } from './app/app.config';
import { TimelineComponent } from './app/timeline.component';

installEmbeddedTheme();

bootstrapApplication(TimelineComponent, appConfig).catch(console.error);
