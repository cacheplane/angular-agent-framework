import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';
import { appConfig } from './app/app.config';
import { RepeatLoopsComponent } from './app/repeat-loops.component';

void bootstrapWithCockpitHarness(RepeatLoopsComponent, appConfig).catch(console.error);
