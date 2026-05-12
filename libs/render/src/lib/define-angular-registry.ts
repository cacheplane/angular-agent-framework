// SPDX-License-Identifier: MIT
import { Type } from '@angular/core';
import type { AngularRegistry, RenderViewEntry } from './render.types';
import { DefaultFallbackComponent } from './default-fallback.component';

type RegistryInput = Record<string, Type<unknown> | RenderViewEntry>;

interface NormalizedEntry {
  component: Type<unknown>;
  fallback: Type<unknown>;
}

function normalize(entry: Type<unknown> | RenderViewEntry): NormalizedEntry {
  // Bare Type — register with the default fallback.
  if (typeof entry === 'function') {
    return { component: entry, fallback: DefaultFallbackComponent };
  }
  // Object form — preserve component; use configured fallback or default.
  return {
    component: entry.component,
    fallback: entry.fallback ?? DefaultFallbackComponent,
  };
}

export function defineAngularRegistry(componentMap: RegistryInput): AngularRegistry {
  const map = new Map<string, NormalizedEntry>();
  for (const [name, entry] of Object.entries(componentMap)) {
    map.set(name, normalize(entry));
  }
  return {
    get: (name: string) => map.get(name)?.component,
    getFallback: (name: string) => map.get(name)?.fallback,
    names: () => [...map.keys()],
  };
}
