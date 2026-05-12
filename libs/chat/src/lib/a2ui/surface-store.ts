// SPDX-License-Identifier: MIT
import { computed, signal, type Signal } from '@angular/core';
import type {
  A2uiMessage, A2uiSurface, A2uiComponent,
  A2uiSurfaceUpdate, A2uiDataModelUpdate, A2uiBeginRendering, A2uiDeleteSurface,
  A2uiDataModelEntry,
} from '@ngaf/a2ui';
import { setByPointer } from '@ngaf/a2ui';

interface SurfaceBuffer {
  /** Pending component map (replaces on next beginRendering). */
  components?: Map<string, A2uiComponent>;
  /** Pending data model deltas accumulated since last beginRendering. */
  dataModelDeltas: { path?: string; contents: A2uiDataModelEntry[] }[];
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
  readonly surfaces: Signal<Map<string, A2uiSurface>>;
  surface(surfaceId: string): Signal<A2uiSurface | undefined>;
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

export function createA2uiSurfaceStore(): A2uiSurfaceStore {
  const surfacesSignal = signal<Map<string, A2uiSurface>>(new Map());
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
        next.set(upd.surfaceId, { ...surface, dataModel });
        surfacesSignal.set(next);
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
      return;
    }
  }

  function surface(surfaceId: string): Signal<A2uiSurface | undefined> {
    return computed(() => surfacesSignal().get(surfaceId));
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
  };
}
