import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';
import { appConfig } from './app/app.config';
import { RegistryComponent } from './app/registry.component';

void bootstrapWithCockpitHarness(RegistryComponent, appConfig).catch(console.error);
