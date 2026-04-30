// SPDX-License-Identifier: MIT
import { Type } from '@angular/core';
import type { AngularRegistry } from './render.types';
import { defineAngularRegistry } from './define-angular-registry';

/**
 * A registry of view components available for generative UI rendering.
 * Plain frozen object mapping view names to Angular component types.
 * Compose via object spread: `views({ ...base, ...more })`.
 */
export type ViewRegistry = Readonly<Record<string, Type<unknown>>>;

/**
 * Creates a view registry from a name → component map.
 */
export function views(map: Record<string, Type<unknown>>): ViewRegistry {
  return Object.freeze({ ...map });
}

/**
 * Adds views to a registry without overwriting existing entries.
 * New keys are added; keys that already exist in `base` are preserved.
 */
export function withViews(
  base: ViewRegistry,
  additions: Record<string, Type<unknown>>,
): ViewRegistry {
  return Object.freeze({ ...additions, ...base });
}

/**
 * Removes views from a registry by name.
 */
export function withoutViews(
  base: ViewRegistry,
  ...names: string[]
): ViewRegistry {
  const result = { ...base };
  for (const name of names) delete result[name];
  return Object.freeze(result);
}

/**
 * Converts a ViewRegistry to an AngularRegistry for use with RenderSpecComponent.
 */
export function toRenderRegistry(registry: ViewRegistry): AngularRegistry {
  return defineAngularRegistry(registry);
}
