// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { AngularComponentRenderer, AngularRegistry } from './render.types';

export function defineAngularRegistry(
  componentMap: Record<string, AngularComponentRenderer>,
): AngularRegistry {
  const map = new Map(Object.entries(componentMap));
  return {
    get: (name: string) => map.get(name),
    names: () => [...map.keys()],
  };
}
