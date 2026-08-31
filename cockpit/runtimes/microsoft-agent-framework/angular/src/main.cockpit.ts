// SPDX-License-Identifier: MIT
import { appConfig } from './app/app.config';
import { MicrosoftAgentFrameworkComponent } from './app/microsoft-agent-framework.component';
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';

bootstrapWithCockpitHarness(MicrosoftAgentFrameworkComponent, appConfig);
