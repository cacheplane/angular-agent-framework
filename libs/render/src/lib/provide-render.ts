// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { InjectionToken, makeEnvironmentProviders } from '@angular/core';
import type { RenderConfig } from './render.types';

export const RENDER_CONFIG = new InjectionToken<RenderConfig>('RENDER_CONFIG');

export function provideRender(config: RenderConfig) {
  return makeEnvironmentProviders([
    { provide: RENDER_CONFIG, useValue: config },
  ]);
}
