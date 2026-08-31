// SPDX-License-Identifier: MIT
import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';
import { appConfig } from './app/app.config';
import { MicrosoftAgentFrameworkComponent } from './app/microsoft-agent-framework.component';

void bootstrapWithCockpitHarness(MicrosoftAgentFrameworkComponent, appConfig).catch(console.error);
