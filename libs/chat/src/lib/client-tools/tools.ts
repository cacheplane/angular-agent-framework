// SPDX-License-Identifier: MIT
import type { Type } from '@angular/core';
import type { StandardSchemaV1, StandardSchemaInferOutput } from '@threadplane/render';
import type { ClientToolDef, FunctionToolDef } from './tool-def';

/** Async function tool — its resolved return value becomes the tool result. */
export function action<S extends StandardSchemaV1, R>(
  description: string,
  schema: S,
  handler: (args: StandardSchemaInferOutput<S>) => R | Promise<R>,
): FunctionToolDef<S, R> {
  return { kind: 'function', description, schema, handler };
}

/** Render-only component tool — the model fills its props; auto-acknowledged. */
export function view(description: string, schema: StandardSchemaV1, component: Type<unknown>): ClientToolDef {
  return { kind: 'view', description, schema, component };
}

/** Interactive (HITL) component tool — the value it emits becomes the result. */
export function ask(description: string, schema: StandardSchemaV1, component: Type<unknown>): ClientToolDef {
  return { kind: 'ask', description, schema, component };
}

/** Collect named client tools into a frozen registry (the key is the tool name).
 *  Generic + `const` over the map so per-tool types and literal keys survive. */
export function tools<const M extends Record<string, ClientToolDef>>(map: M): Readonly<M> {
  return Object.freeze({ ...map });
}
