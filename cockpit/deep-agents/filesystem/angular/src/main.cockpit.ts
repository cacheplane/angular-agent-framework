// SPDX-License-Identifier: MIT
import { appConfig } from './app/app.config';
import { FilesystemComponent } from './app/filesystem.component';
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';

bootstrapWithCockpitHarness(FilesystemComponent, appConfig);
