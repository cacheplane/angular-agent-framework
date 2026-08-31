// SPDX-License-Identifier: MIT
import { appConfig } from './app/app.config';
import { AwsStrandsComponent } from './app/aws-strands.component';
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';

bootstrapWithCockpitHarness(AwsStrandsComponent, appConfig);
