// SPDX-License-Identifier: MIT
import { InjectionToken } from '@angular/core';
import type { StateStore, ComputedFunction } from '@json-render/core';
import type { AngularRegistry } from '../render.types';
import type { RenderEvent } from '../render-event';

export interface RenderContext {
  registry: AngularRegistry;
  store: StateStore;
  functions?: Record<string, ComputedFunction>;
  handlers?: Record<string, (params: Record<string, unknown>) => unknown | Promise<unknown>>;
  emitEvent?: (event: RenderEvent) => void;
  loading?: boolean;
}

export const RENDER_CONTEXT = new InjectionToken<RenderContext>('RENDER_CONTEXT');
