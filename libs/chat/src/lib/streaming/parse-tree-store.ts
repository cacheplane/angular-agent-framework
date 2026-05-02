// SPDX-License-Identifier: MIT
import { signal, type Signal } from '@angular/core';
import type { Spec } from '@json-render/core';
import type { PartialJsonParser, JsonObjectNode } from '@cacheplane/partial-json';
import { materialize } from '@cacheplane/partial-json';

export interface ElementAccumulationState {
  hasType: boolean;
  hasProps: boolean;
  hasChildren: boolean;
  streaming: boolean;
}

export interface ParseTreeStore {
  push(chunk: string): void;
  readonly spec: Signal<Spec | null>;
  readonly elementStates: Signal<Map<string, ElementAccumulationState>>;
}

export function createParseTreeStore(parser: PartialJsonParser): ParseTreeStore {
  const specSignal = signal<Spec | null>(null);
  const elementStatesSignal = signal<Map<string, ElementAccumulationState>>(new Map());

  function computeElementStates(materialized: any): Map<string, ElementAccumulationState> {
    const states = new Map<string, ElementAccumulationState>();
    if (!materialized || typeof materialized !== 'object' || !materialized.elements) {
      return states;
    }

    const elements = materialized.elements as Record<string, any>;
    // We also need the parse tree to know if the element object node is still streaming
    const elementsNode = parser.getByPath('/elements') as JsonObjectNode | null;

    for (const [key, el] of Object.entries(elements)) {
      if (!el || typeof el !== 'object') continue;

      let streaming = true;
      if (elementsNode) {
        const elNode = elementsNode.children.get(key);
        if (elNode && elNode.status === 'complete') {
          streaming = false;
        }
      }

      states.set(key, {
        hasType: 'type' in el && el.type !== undefined,
        hasProps: 'props' in el && el.props !== undefined,
        hasChildren: 'children' in el && el.children !== undefined,
        streaming,
      });
    }

    return states;
  }

  function push(chunk: string): void {
    parser.push(chunk);
    if (parser.root) {
      const materialized = materialize(parser.root);
      specSignal.set(materialized as Spec);
      elementStatesSignal.set(computeElementStates(materialized));
    }
  }

  return {
    push,
    spec: specSignal.asReadonly(),
    elementStates: elementStatesSignal.asReadonly(),
  };
}
