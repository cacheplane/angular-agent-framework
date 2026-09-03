import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';
import { appConfig } from './app/app.config';
import { SpecRenderingComponent } from './app/spec-rendering.component';

void bootstrapWithCockpitHarness(SpecRenderingComponent, appConfig).catch(console.error);
