// SPDX-License-Identifier: MIT
import { InjectionToken, makeEnvironmentProviders } from '@angular/core';
import type { ViewRegistry } from './views';

export const VIEW_REGISTRY = new InjectionToken<ViewRegistry>('VIEW_REGISTRY');

export function provideViews(registry: ViewRegistry) {
  return makeEnvironmentProviders([
    { provide: VIEW_REGISTRY, useValue: registry },
  ]);
}
