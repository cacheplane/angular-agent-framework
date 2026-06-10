// SPDX-License-Identifier: MIT
import type { Spec, UIElement } from '@json-render/core';
import type {
  A2uiSurface, A2uiComponent, A2uiAction, A2uiChildren,
  A2uiActionContextEntry,
} from '@threadplane/a2ui';
import { resolveDynamic, getByPointer, isPathRef } from '@threadplane/a2ui';

const RESERVED_PROP_KEYS = new Set(['child', 'children', 'action', 'tabItems', 'entryPointChild', 'contentChild']);

type RenderedAction = Record<string, { action: string; params: Record<string, unknown> }>;

/** Pull the (single) component-type key + its props from a v1 ComponentDef wrapper. */
function unwrapComponentDef(def: A2uiComponent['component']): { type: string; props: Record<string, unknown> } {
  const entries = Object.entries(def as Record<string, unknown>);
  if (entries.length !== 1) {
    return { type: 'Text', props: {} };
  }
  const [type, props] = entries[0];
  return { type, props: (props ?? {}) as Record<string, unknown> };
}

function resolveAction(
  action: A2uiAction | undefined,
  surface: A2uiSurface,
  sourceComponentId: string,
): RenderedAction | undefined {
  if (!action) return undefined;
  const resolvedContext: Record<string, unknown> = {};
  if (Array.isArray(action.context)) {
    for (const entry of action.context as A2uiActionContextEntry[]) {
      resolvedContext[entry.key] = resolveDynamic(entry.value, surface.dataModel);
    }
  }
  return {
    click: {
      action: 'a2ui:event',
      params: {
        surfaceId: surface.surfaceId,
        sourceComponentId,
        name: action.name,
        context: resolvedContext,
      },
    },
  } as RenderedAction;
}

function childrenToList(
  children: A2uiChildren | undefined,
  surface: A2uiSurface,
): { ids: string[]; templateExpand?: { componentId: string; arrPath: string; arr: unknown[] } } | undefined {
  if (!children) return undefined;
  if ('explicitList' in children) {
    return { ids: children.explicitList };
  }
  if ('template' in children) {
    const t = children.template;
    const arr = getByPointer(surface.dataModel, t.dataBinding);
    if (!Array.isArray(arr)) return { ids: [] };
    const ids = arr.map((_, i) => `${t.componentId}__${i}`);
    return { ids, templateExpand: { componentId: t.componentId, arrPath: t.dataBinding, arr } };
  }
  return undefined;
}

export function surfaceToSpec(surface: A2uiSurface): Spec | null {
  if (surface.components.size === 0) return null;

  const elements: Record<string, UIElement> = {};

  for (const [id, comp] of surface.components) {
    const { type, props: rawProps } = unwrapComponentDef(comp.component);

    const resolvedProps: Record<string, unknown> = {};
    const bindings: Record<string, string> = {};

    for (const [key, value] of Object.entries(rawProps)) {
      if (RESERVED_PROP_KEYS.has(key)) continue;
      if (isPathRef(value)) {
        // Leave path refs as json-render two-way binding markers so the
        // render lib resolves them against its state store on every
        // render. Without this, the catalog component receives a static
        // snapshot taken at conversion time and never reflects user
        // input writes back into the store. The `_bindings` map below
        // tells the catalog component which prop names map to which
        // paths so its injectRenderHost().set(path, value) call can
        // write the typed value back to the render state store.
        const path = (value as { path: string }).path;
        bindings[key] = path;
        resolvedProps[key] = { $bindState: path };
      } else {
        resolvedProps[key] = resolveDynamic(value, surface.dataModel);
      }
    }
    if (Object.keys(bindings).length > 0) {
      resolvedProps['_bindings'] = bindings;
    }

    const action = (rawProps as { action?: A2uiAction }).action;
    const on = resolveAction(action, surface, id);

    // Map children — handle Card single child / Button single child / Modal entryPointChild+contentChild / Tabs tabItems
    let children: string[] | undefined;
    if (type === 'Card' && typeof (rawProps as { child?: unknown }).child === 'string') {
      children = [(rawProps as { child: string }).child];
    } else if (type === 'Button' && typeof (rawProps as { child?: unknown }).child === 'string') {
      children = [(rawProps as { child: string }).child];
    } else if (type === 'Modal') {
      const m = rawProps as { entryPointChild?: string; contentChild?: string };
      const ids: string[] = [];
      if (m.entryPointChild) ids.push(m.entryPointChild);
      if (m.contentChild) ids.push(m.contentChild);
      children = ids;
    } else if (type === 'Tabs') {
      const items = (rawProps as { tabItems?: { title?: unknown; child: string }[] }).tabItems ?? [];
      children = items.map(t => t.child);
      // Resolve tab titles and pass them as a plain string array for the Tabs component's tab bar.
      resolvedProps['tabTitles'] = items.map(t =>
        t.title !== undefined ? String(resolveDynamic(t.title, surface.dataModel)) : '',
      );
    } else if (type === 'MultipleChoice') {
      // Resolve options[*].label (DynamicString) so the component receives plain strings.
      const opts = (rawProps as { options?: { label?: unknown; value: string }[] }).options ?? [];
      resolvedProps['options'] = opts.map(o => ({
        label: o.label !== undefined ? String(resolveDynamic(o.label, surface.dataModel)) : '',
        value: o.value,
      }));
    } else {
      const childInfo = childrenToList((rawProps as { children?: A2uiChildren }).children, surface);
      if (childInfo) {
        children = childInfo.ids;
        if (childInfo.templateExpand) {
          const t = childInfo.templateExpand;
          const templateComp = surface.components.get(t.componentId);
          if (templateComp) {
            const { type: tType, props: tRaw } = unwrapComponentDef(templateComp.component);
            for (let i = 0; i < t.arr.length; i++) {
              const scope = { basePath: `${t.arrPath}/${i}`, item: t.arr[i] };
              const itemProps: Record<string, unknown> = {};
              for (const [k, v] of Object.entries(tRaw)) {
                if (RESERVED_PROP_KEYS.has(k)) continue;
                itemProps[k] = resolveDynamic(v, surface.dataModel, scope);
              }
              elements[`${t.componentId}__${i}`] = { type: tType, props: itemProps };
            }
          }
        }
      }
    }

    elements[id] = {
      type,
      props: resolvedProps,
      ...(children ? { children } : {}),
      ...(on ? { on } : {}),
    };
  }

  // Use `root` if present in the components map; otherwise prefer first id.
  const root = surface.components.has('root')
    ? 'root'
    : (surface.components.keys().next().value as string);

  return { root, elements, state: surface.dataModel } as Spec;
}
