// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component, computed, input, output, ChangeDetectionStrategy,
} from '@angular/core';
import type { Spec } from '@json-render/core';
import type { A2uiSurface, A2uiChildTemplate } from '@cacheplane/a2ui';
import { resolveDynamic, getByPointer } from '@cacheplane/a2ui';
import { RenderSpecComponent, toRenderRegistry } from '@cacheplane/render';
import type { ViewRegistry, RenderEvent } from '@cacheplane/render';

/**
 * Converts an A2UI surface to a json-render Spec by:
 * 1. Walking the flat component map
 * 2. Resolving DynamicValue props against the data model
 * 3. Mapping A2UI children (string[] or template) to json-render children
 * 4. Producing a Spec with root + elements
 */
export function surfaceToSpec(surface: A2uiSurface): Spec | null {
  if (!surface.components.has('root')) return null;

  const elements: Record<string, any> = {};

  for (const [id, comp] of surface.components) {
    const props: Record<string, unknown> = {};

    // Resolve all props except reserved keys, tracking binding paths
    const reserved = new Set(['id', 'component', 'children', 'action', 'checks']);
    const bindings: Record<string, string> = {};
    for (const [key, value] of Object.entries(comp)) {
      if (reserved.has(key)) continue;
      if (typeof value === 'object' && value !== null && 'path' in value && !('call' in value)) {
        bindings[key] = (value as any).path;
      }
      props[key] = resolveDynamic(value, surface.dataModel);
    }
    if (Object.keys(bindings).length > 0) {
      props['_bindings'] = bindings;
    }
    // Map action to spec `on` binding
    let on: Record<string, { action: string; params: Record<string, unknown> }> | undefined;
    if (comp.action) {
      if ('event' in comp.action) {
        const evt = comp.action.event;
        on = {
          click: {
            action: 'a2ui:event',
            params: { surfaceId: surface.surfaceId, name: evt.name, context: evt.context },
          },
        };
      } else if ('functionCall' in comp.action) {
        const fc = comp.action.functionCall;
        on = {
          click: {
            action: 'a2ui:localAction',
            params: { call: fc.call, args: fc.args },
          },
        };
      }
    }
    // Pass checks through
    if (comp.checks) {
      props['checks'] = comp.checks;
    }

    // Map children
    let children: string[] | undefined;
    if (Array.isArray(comp.children)) {
      children = comp.children as string[];
    } else if (comp.children && typeof comp.children === 'object' && 'path' in comp.children) {
      // Template expansion — expand over data model array
      const template = comp.children as A2uiChildTemplate;
      const arr = getByPointer(surface.dataModel, template.path);
      if (Array.isArray(arr)) {
        children = arr.map((_, i) => `${template.componentId}__${i}`);
        const templateComp = surface.components.get(template.componentId);
        if (templateComp) {
          for (let i = 0; i < arr.length; i++) {
            const scope = { basePath: `${template.path}/${i}`, item: arr[i] };
            const itemProps: Record<string, unknown> = {};
            const tplReserved = new Set(['id', 'component', 'children', 'action', 'checks']);
            for (const [key, value] of Object.entries(templateComp)) {
              if (tplReserved.has(key)) continue;
              itemProps[key] = resolveDynamic(value, surface.dataModel, scope);
            }
            elements[`${template.componentId}__${i}`] = {
              type: templateComp.component,
              props: itemProps,
            };
          }
        }
      }
    }

    elements[id] = {
      type: comp.component,
      props,
      ...(children ? { children } : {}),
      ...(on ? { on } : {}),
    };
  }

  return { root: 'root', elements, state: surface.dataModel } as Spec;
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
        [handlers]="internalHandlers()"
        (events)="onRenderEvent($event)"
      />
    }
  `,
})
export class A2uiSurfaceComponent {
  readonly surface = input.required<A2uiSurface>();
  readonly catalog = input.required<ViewRegistry>();
  readonly handlers = input<Record<string, (params: Record<string, unknown>) => unknown | Promise<unknown>>>({});
  readonly events = output<RenderEvent>();

  /** Convert the A2UI surface to a json-render Spec for rendering. */
  readonly spec = computed(() => surfaceToSpec(this.surface()));

  /** Convert ViewRegistry to AngularRegistry for RenderSpecComponent. */
  readonly registry = computed(() => toRenderRegistry(this.catalog()));

  /** Merge built-in A2UI handlers with consumer-provided handlers. */
  readonly internalHandlers = computed(() => {
    const consumerHandlers = this.handlers();
    return {
      'a2ui:event': (params: Record<string, unknown>) => {
        return params;
      },
      'a2ui:localAction': (params: Record<string, unknown>) => {
        const call = params['call'] as string;
        const args = (params['args'] as Record<string, unknown>) ?? {};

        // Consumer handler takes priority
        if (consumerHandlers[call]) {
          return consumerHandlers[call](args);
        }

        // Built-in fallback
        if (call === 'openUrl' && typeof globalThis.window !== 'undefined') {
          globalThis.window.open(String(args['url'] ?? ''), '_blank');
        }
        return undefined;
      },
    };
  });

  onRenderEvent(event: RenderEvent): void {
    this.events.emit(event);
  }
}
