// SPDX-License-Identifier: MIT
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';
import { appConfig } from './app/app.config';
import { AwsStrandsComponent } from './app/aws-strands.component';

void bootstrapWithCockpitHarness(AwsStrandsComponent, appConfig).catch(console.error);
