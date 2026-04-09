// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { computed, signal, type Signal } from '@angular/core';
import type { A2uiMessage, A2uiSurface } from '@cacheplane/a2ui';
import { setByPointer, deleteByPointer } from '@cacheplane/a2ui';

export interface A2uiSurfaceStore {
  apply(message: A2uiMessage): void;
  readonly surfaces: Signal<Map<string, A2uiSurface>>;
  surface(surfaceId: string): Signal<A2uiSurface | undefined>;
}

export function createA2uiSurfaceStore(): A2uiSurfaceStore {
  const surfacesSignal = signal<Map<string, A2uiSurface>>(new Map());

  function apply(message: A2uiMessage): void {
    const current = surfacesSignal();

    switch (message.type) {
      case 'createSurface': {
        const next = new Map(current);
        next.set(message.surfaceId, {
          surfaceId: message.surfaceId,
          catalogId: message.catalogId,
          theme: message.theme,
          components: new Map(),
          dataModel: {},
        });
        surfacesSignal.set(next);
        break;
      }
      case 'updateComponents': {
        const surface = current.get(message.surfaceId);
        if (!surface) return;
        const components = new Map(surface.components);
        for (const comp of message.components) {
          components.set(comp.id, comp);
        }
        const next = new Map(current);
        next.set(message.surfaceId, { ...surface, components });
        surfacesSignal.set(next);
        break;
      }
      case 'updateDataModel': {
        const surface = current.get(message.surfaceId);
        if (!surface) return;
        let dataModel: Record<string, unknown>;
        if (message.path === undefined || message.path === '/') {
          dataModel = (message.value as Record<string, unknown>) ?? {};
        } else if (message.value === undefined) {
          dataModel = deleteByPointer(surface.dataModel, message.path);
        } else {
          dataModel = setByPointer(surface.dataModel, message.path, message.value);
        }
        const next = new Map(current);
        next.set(message.surfaceId, { ...surface, dataModel });
        surfacesSignal.set(next);
        break;
      }
      case 'deleteSurface': {
        const next = new Map(current);
        next.delete(message.surfaceId);
        surfacesSignal.set(next);
        break;
      }
    }
  }

  function surface(surfaceId: string): Signal<A2uiSurface | undefined> {
    return computed(() => surfacesSignal().get(surfaceId));
  }

  return {
    apply,
    surfaces: surfacesSignal.asReadonly(),
    surface,
  };
}
