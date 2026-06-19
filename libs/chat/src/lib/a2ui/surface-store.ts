// SPDX-License-Identifier: MIT
import { computed, signal, type Signal } from '@angular/core';
import type {
  A2uiMessage, A2uiSurface, A2uiComponent,
  A2uiSurfaceUpdate, A2uiDataModelUpdate, A2uiBeginRendering, A2uiDeleteSurface,
  A2uiDataModelEntry,
} from '@threadplane/a2ui';
import { setByPointer } from '@threadplane/a2ui';
import type { A2uiComponentView } from './component-view';
import { extractBindings } from './extract-bindings';

interface SurfaceBuffer {
  /** Pending component map (replaces on next beginRendering). */
  components?: Map<string, A2uiComponent>;
  /** Pending per-component views (replaces on next beginRendering). */
  componentViews?: Map<string, A2uiComponentView>;
  /** Pending data model deltas accumulated since last beginRendering. */
  dataModelDeltas: { path?: string; contents: A2uiDataModelEntry[] }[];
}

/** Chat-side state for a surface — wraps the wire-format `A2uiSurface`
 * with the per-component projection the progressive renderer consumes.
 * Both maps are kept in sync; the wire shape preserves existing
 * `surfaceToSpec` semantics, the view shape carries readiness. */
export interface A2uiSurfaceState {
  readonly surface: A2uiSurface;
  readonly componentViews: ReadonlyMap<string, A2uiComponentView>;
}

export interface A2uiSurfaceStore {
  apply(message: A2uiMessage): void;
  /**
   * Live-stream entry point. Iterates envelopes and feeds each through
   * `apply()`. Records the tool_call_id so the wrapped-content classifier
   * can short-circuit duplicate dispatch when the final AIMessage arrives.
   */
  applyPartialArgs(toolCallId: string, envelopes: readonly A2uiMessage[]): void;
  /** True if a tool_call_id has produced live envelopes via applyPartialArgs. */
  isPartialLive(toolCallId: string): boolean;
  /** Wire-format surfaces, for downstream consumers (e.g. surfaceToSpec). */
  readonly surfaces: Signal<Map<string, A2uiSurface>>;
  surface(surfaceId: string): Signal<A2uiSurface | undefined>;
  /** Chat-side projections with per-component readiness. */
  readonly surfaceStates: Signal<Map<string, A2uiSurfaceState>>;
  surfaceState(surfaceId: string): Signal<A2uiSurfaceState | undefined>;
}

function entriesToObject(entries: A2uiDataModelEntry[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const e of entries) {
    if ('valueString' in e && e.valueString !== undefined) out[e.key] = e.valueString;
    else if ('valueNumber' in e && e.valueNumber !== undefined) out[e.key] = e.valueNumber;
    else if ('valueBoolean' in e && e.valueBoolean !== undefined) out[e.key] = e.valueBoolean;
    else if ('valueMap' in e && Array.isArray(e.valueMap)) out[e.key] = entriesToObject(e.valueMap);
  }
  return out;
}

/** Returns true if `path` (in `$.a.b.c` form) resolves to a defined,
 * non-null value inside `dataModel`. Used to decide per-component
 * readiness. */
function isResolved(dataModel: Record<string, unknown>, path: string): boolean {
  const segments = path.startsWith('$.') ? path.slice(2).split('.') : path.split('.');
  let cur: unknown = dataModel;
  for (const seg of segments) {
    if (cur == null || typeof cur !== 'object') return false;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur !== undefined && cur !== null;
}

/** Resolve `{$.path}` references in a value against the data model.
 * Strings that look like a single full reference are replaced with
 * the resolved value; partial-reference strings get string-substituted;
 * nested objects/arrays are recursed. */
function resolveProps(value: unknown, dataModel: Record<string, unknown>): unknown {
  if (typeof value === 'string') {
    const full = value.match(/^\{(\$\.[^}]+)\}$/);
    if (full) {
      const segs = full[1].slice(2).split('.');
      let cur: unknown = dataModel;
      for (const s of segs) {
        if (cur == null || typeof cur !== 'object') return undefined;
        cur = (cur as Record<string, unknown>)[s];
      }
      return cur;
    }
    return value.replace(/\{(\$\.[^}]+)\}/g, (_, path: string) => {
      const segs = path.slice(2).split('.');
      let cur: unknown = dataModel;
      for (const s of segs) {
        if (cur == null || typeof cur !== 'object') return '';
        cur = (cur as Record<string, unknown>)[s];
      }
      return cur == null ? '' : String(cur);
    });
  }
  if (Array.isArray(value)) return value.map((v) => resolveProps(v, dataModel));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = resolveProps(v, dataModel);
    }
    return out;
  }
  return value;
}

/**
 * Create an {@link A2uiSurfaceStore} — the per-conversation store that buffers
 * streamed A2UI surface updates, tracks each surface's data model + lifecycle
 * state, and exposes them as signals for rendering. One store backs a chat
 * thread's A2UI surfaces.
 *
 * @returns A fresh, empty {@link A2uiSurfaceStore}.
 * @example
 * ```ts
 * const store = createA2uiSurfaceStore();
 * const surfaces = store.surfaces; // Signal<Map<string, A2uiSurface>>
 * ```
 */
export function createA2uiSurfaceStore(): A2uiSurfaceStore {
  const surfacesSignal = signal<Map<string, A2uiSurface>>(new Map());
  const surfaceStatesSignal = signal<Map<string, A2uiSurfaceState>>(new Map());
  const buffers = new Map<string, SurfaceBuffer>();

  function bufferOf(surfaceId: string): SurfaceBuffer {
    let b = buffers.get(surfaceId);
    if (!b) { b = { dataModelDeltas: [] }; buffers.set(surfaceId, b); }
    return b;
  }

  function apply(message: A2uiMessage): void {
    if ('surfaceUpdate' in message) {
      const upd = message.surfaceUpdate as A2uiSurfaceUpdate;
      const b = bufferOf(upd.surfaceId);
      const map = new Map<string, A2uiComponent>();
      for (const c of upd.components) map.set(c.id, c);
      b.components = map;
      // Project per-component views with bindings extracted from prop
      // expressions. ready starts false; props starts empty.
      const views = new Map<string, A2uiComponentView>();
      for (const c of upd.components) {
        const def = c.component;
        const typeKey = (def && typeof def === 'object')
          ? (Object.keys(def)[0] ?? 'Unknown')
          : 'Unknown';
        views.set(c.id, {
          id: c.id,
          type: typeKey,
          bindings: extractBindings(def),
          ready: false,
          props: {},
          def,
        });
      }
      b.componentViews = views;
      return;
    }
    if ('dataModelUpdate' in message) {
      const upd = message.dataModelUpdate as A2uiDataModelUpdate;
      const surface = surfacesSignal().get(upd.surfaceId);
      if (surface) {
        // Already-rendered surface: apply incrementally.
        let dataModel = surface.dataModel;
        const obj = entriesToObject(upd.contents);
        if (upd.path && upd.path !== '/') {
          for (const [k, v] of Object.entries(obj)) {
            dataModel = setByPointer(dataModel, `${upd.path}/${k}`, v);
          }
        } else {
          dataModel = { ...dataModel, ...obj };
        }
        const next = new Map(surfacesSignal());
        const nextSurface = { ...surface, dataModel };
        next.set(upd.surfaceId, nextSurface);
        surfacesSignal.set(next);

        // Recompute per-component readiness with the monotonic rule.
        const prevState = surfaceStatesSignal().get(upd.surfaceId);
        if (prevState) {
          const nextViews = new Map<string, A2uiComponentView>();
          for (const [id, v] of prevState.componentViews) {
            const allResolved = v.bindings.every((p) => isResolved(dataModel, p));
            // Monotonic: once ready=true, stays true even if a later
            // update clears a referenced path.
            const nextReady = v.ready || allResolved;
            nextViews.set(id, {
              ...v,
              ready: nextReady,
              props: nextReady
                ? (resolveProps(v.def, dataModel) as Record<string, unknown>)
                : v.props,
            });
          }
          const nextStatesMap = new Map(surfaceStatesSignal());
          nextStatesMap.set(upd.surfaceId, { surface: nextSurface, componentViews: nextViews });
          surfaceStatesSignal.set(nextStatesMap);
        }
      } else {
        // Pre-render: buffer the delta.
        const b = bufferOf(upd.surfaceId);
        b.dataModelDeltas.push({ path: upd.path, contents: upd.contents });
      }
      return;
    }
    if ('beginRendering' in message) {
      const begin = message.beginRendering as A2uiBeginRendering;
      const b = buffers.get(begin.surfaceId);
      if (!b || !b.components) return; // no surfaceUpdate yet — no-op
      // Build initial data model from buffered deltas.
      let dataModel: Record<string, unknown> = {};
      for (const d of b.dataModelDeltas) {
        const obj = entriesToObject(d.contents);
        if (d.path && d.path !== '/') {
          for (const [k, v] of Object.entries(obj)) {
            dataModel = setByPointer(dataModel, `${d.path}/${k}`, v);
          }
        } else {
          dataModel = { ...dataModel, ...obj };
        }
      }
      // Merge with any existing surface's dataModel if this is a re-render.
      const existing = surfacesSignal().get(begin.surfaceId);
      if (existing) {
        dataModel = { ...existing.dataModel, ...dataModel };
      }
      // Capture v1 styles (font, primaryColor) from beginRendering. A
      // re-render keeps any prior styles unless the new beginRendering
      // explicitly overrides them — this matches the agent's likely
      // intent ("change the data, keep the look").
      const nextStyles = begin.styles
        ?? existing?.styles;
      const surface: A2uiSurface = {
        surfaceId: begin.surfaceId,
        catalogId: 'basic',
        components: b.components,
        dataModel,
        ...(nextStyles ? { styles: nextStyles } : {}),
      };
      const next = new Map(surfacesSignal());
      next.set(begin.surfaceId, surface);
      surfacesSignal.set(next);

      // Project per-component views with initial readiness based on the
      // accumulated data model.
      const baseViews = b.componentViews ?? new Map<string, A2uiComponentView>();
      const initialViews = new Map<string, A2uiComponentView>();
      for (const [id, v] of baseViews) {
        const allResolved = v.bindings.every((p) => isResolved(dataModel, p));
        initialViews.set(id, {
          ...v,
          ready: allResolved,
          props: allResolved
            ? (resolveProps(v.def, dataModel) as Record<string, unknown>)
            : {},
        });
      }
      const nextStates = new Map(surfaceStatesSignal());
      nextStates.set(begin.surfaceId, { surface, componentViews: initialViews });
      surfaceStatesSignal.set(nextStates);

      // Reset buffer so subsequent surfaceUpdate is the next round.
      buffers.set(begin.surfaceId, { dataModelDeltas: [] });
      return;
    }
    if ('deleteSurface' in message) {
      const del = message.deleteSurface as A2uiDeleteSurface;
      buffers.delete(del.surfaceId);
      const next = new Map(surfacesSignal());
      next.delete(del.surfaceId);
      surfacesSignal.set(next);
      const nextStates = new Map(surfaceStatesSignal());
      nextStates.delete(del.surfaceId);
      surfaceStatesSignal.set(nextStates);
      return;
    }
  }

  function surface(surfaceId: string): Signal<A2uiSurface | undefined> {
    return computed(() => surfacesSignal().get(surfaceId));
  }

  function surfaceState(surfaceId: string): Signal<A2uiSurfaceState | undefined> {
    return computed(() => surfaceStatesSignal().get(surfaceId));
  }

  const liveTools = new Set<string>();

  function applyPartialArgs(
    toolCallId: string,
    envelopes: readonly A2uiMessage[],
  ): void {
    liveTools.add(toolCallId);
    for (const env of envelopes) {
      apply(env);
    }
  }

  function isPartialLive(toolCallId: string): boolean {
    return liveTools.has(toolCallId);
  }

  return {
    apply,
    applyPartialArgs,
    isPartialLive,
    surfaces: surfacesSignal.asReadonly(),
    surface,
    surfaceStates: surfaceStatesSignal.asReadonly(),
    surfaceState,
  };
}
