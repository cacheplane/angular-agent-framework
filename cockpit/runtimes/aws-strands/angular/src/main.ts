// SPDX-License-Identifier: MIT
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AwsStrandsComponent } from './app/aws-strands.component';

bootstrapApplication(AwsStrandsComponent, appConfig).catch(console.error);
