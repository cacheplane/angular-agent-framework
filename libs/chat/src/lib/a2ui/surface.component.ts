// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component, computed, input, ChangeDetectionStrategy,
} from '@angular/core';
import type { Spec } from '@json-render/core';
import type { A2uiSurface } from '@cacheplane/a2ui';
import { resolveDynamic } from '@cacheplane/a2ui';
import { RenderSpecComponent, toRenderRegistry } from '@cacheplane/render';
import type { ViewRegistry } from '@cacheplane/render';

/**
 * Converts an A2UI surface to a json-render Spec by:
 * 1. Walking the flat component map
 * 2. Resolving DynamicValue props against the data model
 * 3. Mapping A2UI children (string[] or template) to json-render children
 * 4. Producing a Spec with root + elements
 */
function surfaceToSpec(surface: A2uiSurface): Spec | null {
  if (!surface.components.has('root')) return null;

  const elements: Record<string, any> = {};

  for (const [id, comp] of surface.components) {
    const props: Record<string, unknown> = {};

    // Resolve all props except reserved keys
    const reserved = new Set(['id', 'component', 'children', 'action', 'checks']);
    for (const [key, value] of Object.entries(comp)) {
      if (reserved.has(key)) continue;
      props[key] = resolveDynamic(value, surface.dataModel);
    }

    // Map children
    let children: string[] | undefined;
    if (Array.isArray(comp.children)) {
      children = comp.children as string[];
    }
    // Template children (collection expansion) — Phase 2 for full implementation
    // For now, skip template children

    elements[id] = {
      type: comp.component,
      props,
      ...(children ? { children } : {}),
    };
  }

  return { root: 'root', elements } as Spec;
}

@Component({
  selector: 'a2ui-surface',
  standalone: true,
  imports: [RenderSpecComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (spec(); as s) {
      <render-spec
        [spec]="s"
        [registry]="registry()"
      />
    }
  `,
})
export class A2uiSurfaceComponent {
  readonly surface = input.required<A2uiSurface>();
  readonly catalog = input.required<ViewRegistry>();

  /** Convert the A2UI surface to a json-render Spec for rendering. */
  readonly spec = computed(() => surfaceToSpec(this.surface()));

  /** Convert ViewRegistry to AngularRegistry for RenderSpecComponent. */
  readonly registry = computed(() => toRenderRegistry(this.catalog()));
}
