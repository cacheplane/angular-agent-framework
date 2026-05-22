// SPDX-License-Identifier: MIT
import { InjectionToken, makeEnvironmentProviders } from '@angular/core';
import type { RenderConfig } from './render.types';
import { RENDER_LIFECYCLE } from './lifecycle';
import { RenderLifecycleService } from './render-lifecycle.service';

export const RENDER_CONFIG = new InjectionToken<RenderConfig>('RENDER_CONFIG');

export function provideRender(config: RenderConfig) {
  return makeEnvironmentProviders([
    { provide: RENDER_CONFIG, useValue: config },
    RenderLifecycleService,
    { provide: RENDER_LIFECYCLE, useExisting: RenderLifecycleService },
  ]);
}
