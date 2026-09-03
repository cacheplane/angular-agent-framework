import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';
import { appConfig } from './app/app.config';
import { StateManagementComponent } from './app/state-management.component';

void bootstrapWithCockpitHarness(StateManagementComponent, appConfig).catch(console.error);
