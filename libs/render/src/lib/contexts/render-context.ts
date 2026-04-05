// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { InjectionToken } from '@angular/core';
import type { StateStore, ComputedFunction } from '@json-render/core';
import type { AngularRegistry } from '../render.types';

export interface RenderContext {
  registry: AngularRegistry;
  store: StateStore;
  functions?: Record<string, ComputedFunction>;
  handlers?: Record<string, (params: Record<string, unknown>) => unknown | Promise<unknown>>;
  loading?: boolean;
}

export const RENDER_CONTEXT = new InjectionToken<RenderContext>('RENDER_CONTEXT');
