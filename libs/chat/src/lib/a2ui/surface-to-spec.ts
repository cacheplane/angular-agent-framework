// SPDX-License-Identifier: MIT
import type { Spec, UIElement } from '@json-render/core';
import type { A2uiSurface, A2uiChildTemplate } from '@ngaf/a2ui';
import { resolveDynamic, getByPointer, evaluateCheckRules, isPathRef } from '@ngaf/a2ui';

const RESERVED_KEYS = new Set(['id', 'component', 'children', 'action', 'checks', '_bindings']);

/**
 * Converts an A2UI surface to a json-render Spec by:
 * 1. Walking the flat component map
 * 2. Resolving DynamicValue props against the data model
 * 3. Mapping A2UI children (string[] or template) to json-render children
 * 4. Producing a Spec with root + elements
 */
export function surfaceToSpec(surface: A2uiSurface): Spec | null {
  if (!surface.components.has('root')) return null;

  const elements: Record<string, UIElement> = {};

  for (const [id, comp] of surface.components) {
    const props: Record<string, unknown> = {};

    // Resolve all props except reserved keys, tracking binding paths
    const bindings: Record<string, string> = {};
    for (const [key, value] of Object.entries(comp)) {
      if (RESERVED_KEYS.has(key)) continue;
      if (isPathRef(value)) {
        bindings[key] = value.path;
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
        const resolvedContext: Record<string, unknown> = {};
        if (evt.context) {
          for (const [key, value] of Object.entries(evt.context)) {
            resolvedContext[key] = resolveDynamic(value, surface.dataModel);
          }
        }
        on = {
          click: {
            action: 'a2ui:event',
            params: {
              surfaceId: surface.surfaceId,
              sourceComponentId: id,
              name: evt.name,
              context: resolvedContext,
            },
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
    // Evaluate checks and attach pre-computed validation result
    if (comp.checks) {
      props['validationResult'] = evaluateCheckRules(comp.checks, surface.dataModel);
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
            for (const [key, value] of Object.entries(templateComp)) {
              if (RESERVED_KEYS.has(key)) continue;
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
