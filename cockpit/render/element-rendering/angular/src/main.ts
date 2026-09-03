import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';
import { appConfig } from './app/app.config';
import { ElementRenderingComponent } from './app/element-rendering.component';

void bootstrapWithCockpitHarness(ElementRenderingComponent, appConfig).catch(console.error);
