// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { signal, type Signal } from '@angular/core';
import type { Spec } from '@json-render/core';
import { createPartialJsonParser } from '@cacheplane/partial-json';
import { createParseTreeStore, type ElementAccumulationState, type ParseTreeStore } from './parse-tree-store';

export type ContentType = 'undetermined' | 'markdown' | 'json-render' | 'a2ui' | 'mixed';

const A2UI_PREFIX = '---a2ui_JSON---';

export interface ContentClassifier {
  update(content: string): void;
  readonly type: Signal<ContentType>;
  readonly markdown: Signal<string>;
  readonly spec: Signal<Spec | null>;
  readonly elementStates: Signal<Map<string, ElementAccumulationState>>;
  readonly streaming: Signal<boolean>;
  dispose(): void;
}

export function createContentClassifier(): ContentClassifier {
  const typeSignal = signal<ContentType>('undetermined');
  const markdownSignal = signal<string>('');
  const specSignal = signal<Spec | null>(null);
  const elementStatesSignal = signal<Map<string, ElementAccumulationState>>(new Map());
  const streamingSignal = signal<boolean>(false);

  let processedLength = 0;
  let store: ParseTreeStore | null = null;
  let jsonStartIndex = 0;

  function detectType(content: string): ContentType {
    // Find first non-whitespace character
    for (let i = 0; i < content.length; i++) {
      const ch = content[i];
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') continue;

      if (content.startsWith(A2UI_PREFIX, i)) {
        return 'a2ui';
      }
      if (ch === '{') {
        return 'json-render';
      }
      return 'markdown';
    }
    return 'undetermined';
  }

  function initJsonStore(jsonContent: string): void {
    const parser = createPartialJsonParser();
    store = createParseTreeStore(parser);
    if (jsonContent.length > 0) {
      store.push(jsonContent);
    }
    syncJsonSignals();
  }

  function syncJsonSignals(): void {
    if (!store) return;
    specSignal.set(store.spec());
    elementStatesSignal.set(store.elementStates());

    // Determine streaming state from the parser root node status
    const spec = store.spec();
    if (spec) {
      // Check if the root JSON object is complete by seeing if materialize produced a complete object
      // We check by looking at the parse tree store's underlying parser root status
      // A simpler heuristic: if the spec has both root and elements defined and the last char was }, it's likely complete
      // But we can use the parser events approach. Let's check the element states for streaming.
      streamingSignal.set(isStillStreaming());
    } else {
      streamingSignal.set(true);
    }
  }

  function isStillStreaming(): boolean {
    if (!store) return false;
    // If the store has a spec, check if any elements are still streaming
    // or if the root object itself hasn't closed yet
    const states = store.elementStates();
    for (const state of states.values()) {
      if (state.streaming) return true;
    }
    // Also check if the spec has basic completeness: root + elements
    const spec = store.spec();
    if (!spec || !spec.root || !spec.elements) return true;
    return false;
  }

  function update(content: string): void {
    const currentType = typeSignal();

    if (currentType === 'undetermined') {
      const detected = detectType(content);
      if (detected === 'undetermined') return;

      typeSignal.set(detected);

      if (detected === 'markdown') {
        markdownSignal.set(content);
        processedLength = content.length;
      } else if (detected === 'json-render') {
        streamingSignal.set(true);
        // Find where JSON starts (skip whitespace)
        jsonStartIndex = 0;
        for (let i = 0; i < content.length; i++) {
          if (content[i] !== ' ' && content[i] !== '\t' && content[i] !== '\n' && content[i] !== '\r') {
            jsonStartIndex = i;
            break;
          }
        }
        const jsonContent = content.slice(jsonStartIndex);
        initJsonStore(jsonContent);
        processedLength = content.length;
      } else if (detected === 'a2ui') {
        streamingSignal.set(true);
        jsonStartIndex = content.indexOf(A2UI_PREFIX) + A2UI_PREFIX.length;
        const jsonContent = content.slice(jsonStartIndex);
        if (jsonContent.length > 0) {
          initJsonStore(jsonContent);
        }
        processedLength = content.length;
      }
      return;
    }

    // Compute delta
    const delta = content.slice(processedLength);
    processedLength = content.length;

    if (delta.length === 0) return;

    if (currentType === 'markdown' || currentType === 'mixed') {
      markdownSignal.set(content);
    } else if (currentType === 'json-render' || currentType === 'a2ui') {
      if (store) {
        store.push(delta);
        syncJsonSignals();
      }
    }
  }

  function dispose(): void {
    store = null;
  }

  return {
    update,
    type: typeSignal.asReadonly(),
    markdown: markdownSignal.asReadonly(),
    spec: specSignal.asReadonly(),
    elementStates: elementStatesSignal.asReadonly(),
    streaming: streamingSignal.asReadonly(),
    dispose,
  };
}
