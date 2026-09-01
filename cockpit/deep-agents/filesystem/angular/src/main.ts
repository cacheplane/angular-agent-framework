// SPDX-License-Identifier: MIT
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';
import { appConfig } from './app/app.config';
import { FilesystemComponent } from './app/filesystem.component';

void bootstrapWithCockpitHarness(FilesystemComponent, appConfig).catch(console.error);
