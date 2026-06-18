// SPDX-License-Identifier: MIT
import { Type } from '@angular/core';
import type { AngularRegistry, NormalizedEntry, RenderViewEntry } from './render.types';
import { DefaultFallbackComponent } from './default-fallback.component';

type RegistryInput = Record<string, Type<unknown> | RenderViewEntry>;

function normalize(entry: Type<unknown> | RenderViewEntry): NormalizedEntry {
  if (typeof entry === 'function') {
    return { component: entry, fallback: DefaultFallbackComponent };
  }
  return {
    component: entry.component,
    fallback: entry.fallback ?? DefaultFallbackComponent,
    schema: entry.schema,
    description: entry.description,
  };
}

export function defineAngularRegistry(componentMap: RegistryInput): AngularRegistry {
  const map = new Map<string, NormalizedEntry>();
  for (const [name, entry] of Object.entries(componentMap)) {
    map.set(name, normalize(entry));
  }
  return {
    getEntry: (name: string) => map.get(name),
    names: () => [...map.keys()],
  };
}
