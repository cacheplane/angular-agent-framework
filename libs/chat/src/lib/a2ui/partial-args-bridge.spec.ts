// libs/chat/src/lib/a2ui/partial-args-bridge.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import type { A2uiMessage } from '@ngaf/a2ui';
import { createPartialArgsBridge } from './partial-args-bridge';
import { createA2uiSurfaceStore, type A2uiSurfaceStore } from './surface-store';

function makeStore(): A2uiSurfaceStore {
  let store!: A2uiSurfaceStore;
  TestBed.configureTestingModule({});
  TestBed.runInInjectionContext(() => {
    store = createA2uiSurfaceStore();
  });
  return store;
}

describe('createPartialArgsBridge', () => {
  let store: A2uiSurfaceStore;
  beforeEach(() => { store = makeStore(); });

  function chunks(...frames: string[]): readonly string[] {
    return frames;
  }

  it('extracts a surfaceUpdate envelope as soon as it parses, mounts surface via synthetic beginRendering', () => {
    const bridge = createPartialArgsBridge(store);
    const frames = chunks(
      '{"envelopes":[',
      '{"envelopes":[{"surfaceUpdate":{"surfaceId":"s","components":[{"id":"root","type":"text","props":{}}]}}',
      '{"envelopes":[{"surfaceUpdate":{"surfaceId":"s","components":[{"id":"root","type":"text","props":{}}]}},',
    );
    for (const f of frames) bridge.push('tc-1', f);
    // After surfaceUpdate parses and bridge synthesises beginRendering, the surface materialises.
    expect(store.surfaces().get('s')?.components.has('root')).toBe(true);
  });

  it('does not synthesise twice if the LLM emits its own beginRendering later', () => {
    const bridge = createPartialArgsBridge(store);
    const surfaceUpdate = JSON.stringify({ surfaceUpdate: { surfaceId: 's', components: [{ id: 'root', type: 'text', props: {} }] } });
    const beginRendering = JSON.stringify({ beginRendering: { surfaceId: 's', root: 'root' } });
    bridge.push('tc-2', '{"envelopes":[' + surfaceUpdate + ',' + beginRendering + ']}');
    // Same surface, single mount — components map unchanged across the second beginRendering.
    const surface = store.surfaces().get('s');
    expect(surface).toBeTruthy();
    expect(surface!.components.size).toBe(1);
  });

  it('handles the singular {envelope:[...]} shape', () => {
    const bridge = createPartialArgsBridge(store);
    bridge.push('tc-3', '{"envelope":[{"surfaceUpdate":{"surfaceId":"s","components":[{"id":"root","type":"text","props":{}}]}}]}');
    expect(store.surfaces().get('s')?.components.has('root')).toBe(true);
  });

  it('handles positional keys {0: env, 1: env}', () => {
    const bridge = createPartialArgsBridge(store);
    const envs = [
      { surfaceUpdate: { surfaceId: 's', components: [{ id: 'root', type: 'text', props: {} }] } },
      { dataModelUpdate: { surfaceId: 's', contents: [{ key: 'msg', valueString: 'hi' }] } },
    ];
    bridge.push('tc-4', JSON.stringify({ 0: envs[0], 1: envs[1] }));
    expect(store.surfaces().get('s')?.dataModel).toEqual({ msg: 'hi' });
  });

  it('marks tool_call_id as live in the store once the initial surface pair dispatches', () => {
    const bridge = createPartialArgsBridge(store);
    bridge.push(
      'tc-5',
      '{"envelopes":[{"surfaceUpdate":{"surfaceId":"s","components":[{"id":"root","type":"text","props":{}}]}}]}',
    );
    expect(store.isPartialLive('tc-5')).toBe(true);
  });

  it('does not dispatch the same envelope twice across incremental pushes', () => {
    const bridge = createPartialArgsBridge(store);
    const piece1 = '{"envelopes":[{"surfaceUpdate":{"surfaceId":"s","components":[{"id":"root","type":"text","props":{}}]}}';
    const piece2 = piece1 + ',{"dataModelUpdate":{"surfaceId":"s","contents":[{"key":"k","valueString":"v"}]}}]}';
    bridge.push('tc-6', piece1);
    bridge.push('tc-6', piece2);
    // The dataModelUpdate appears only in the second push but bridge re-runs the parser
    // against the cumulative buffer; the surfaceUpdate envelope must NOT re-dispatch.
    expect(store.surfaces().get('s')?.dataModel).toEqual({ k: 'v' });
  });

  it('marks tool_call_id as poisoned if a chunk is invalid JSON garbage', () => {
    const bridge = createPartialArgsBridge(store);
    bridge.push('tc-7', '{{{not_json');
    // Subsequent valid pushes are ignored once poisoned.
    bridge.push('tc-7', '{"envelopes":[{"surfaceUpdate":{"surfaceId":"s","components":[]}}]}');
    expect(store.surfaces().size).toBe(0);
  });

  it('synthetic beginRendering picks first component when none has id="root"', () => {
    const bridge = createPartialArgsBridge(store);
    bridge.push('tc-8', '{"envelopes":[{"surfaceUpdate":{"surfaceId":"s","components":[{"id":"only","type":"text","props":{}}]}}]}');
    expect(store.surfaces().get('s')?.components.has('only')).toBe(true);
  });

  it('incremental push waits for a component id before mounting the surface', () => {
    const bridge = createPartialArgsBridge(store);
    // 1: object started, no id on first component yet.
    bridge.push('tc-9', '{"envelopes":[{"surfaceUpdate":{"surfaceId":"s","components":[{');
    expect(store.surfaces().has('s')).toBe(false);
    // 2: started the "id" key but no value yet.
    bridge.push('tc-9', '{"envelopes":[{"surfaceUpdate":{"surfaceId":"s","components":[{"');
    expect(store.surfaces().has('s')).toBe(false);
    // 3: id, type, props all present and component object is closed.
    bridge.push(
      'tc-9',
      '{"envelopes":[{"surfaceUpdate":{"surfaceId":"s","components":[{"id":"root","type":"text","props":{}}]}}',
    );
    expect(store.surfaces().get('s')?.components.has('root')).toBe(true);
  });

  it('mounts the surface on first complete push and applies a dataModelUpdate on a later push', () => {
    const bridge = createPartialArgsBridge(store);
    const surfaceUpdate = JSON.stringify({
      surfaceUpdate: { surfaceId: 's', components: [{ id: 'root', type: 'text', props: {} }] },
    });
    const dataModelUpdate = JSON.stringify({
      dataModelUpdate: { surfaceId: 's', contents: [{ key: 'greeting', valueString: 'hello' }] },
    });
    bridge.push('tc-10', '{"envelopes":[' + surfaceUpdate + ']}');
    expect(store.surfaces().get('s')?.components.has('root')).toBe(true);
    expect(store.surfaces().get('s')?.dataModel).toEqual({});
    bridge.push('tc-10', '{"envelopes":[' + surfaceUpdate + ',' + dataModelUpdate + ']}');
    expect(store.surfaces().get('s')?.dataModel).toEqual({ greeting: 'hello' });
  });

  it('synthetic beginRendering targets the first component when multiple have ids and none is "root"', () => {
    // Spy on applyPartialArgs to inspect the synthesised beginRendering envelope.
    const captured: A2uiMessage[][] = [];
    const orig = store.applyPartialArgs.bind(store);
    (store as { applyPartialArgs: typeof store.applyPartialArgs }).applyPartialArgs = (
      toolCallId: string,
      envs: readonly A2uiMessage[],
    ) => {
      captured.push(envs.slice() as A2uiMessage[]);
      orig(toolCallId, envs);
    };
    const bridge = createPartialArgsBridge(store);
    bridge.push(
      'tc-11',
      '{"envelopes":[{"surfaceUpdate":{"surfaceId":"s","components":[{"id":"alpha","type":"text","props":{}},{"id":"beta","type":"text","props":{}}]}}]}',
    );
    const surface = store.surfaces().get('s');
    expect(surface).toBeTruthy();
    expect(surface!.components.has('alpha')).toBe(true);
    expect(surface!.components.has('beta')).toBe(true);
    // First dispatch should be [surfaceUpdate, synthesised beginRendering with root="alpha"].
    expect(captured.length).toBeGreaterThan(0);
    const firstBatch = captured[0];
    const beginEnv = firstBatch.find((e) => 'beginRendering' in e) as
      | { beginRendering: { surfaceId: string; root: string } }
      | undefined;
    expect(beginEnv).toBeTruthy();
    expect(beginEnv!.beginRendering.root).toBe('alpha');
  });
});
