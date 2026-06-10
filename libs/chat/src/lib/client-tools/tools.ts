// SPDX-License-Identifier: MIT
import type { Type } from '@angular/core';
import type { StandardSchemaV1, StandardSchemaInferOutput } from '@threadplane/render';
import type { ClientToolDef, ClientToolRegistry, FunctionToolDef } from './tool-def';

/** Async function tool — its resolved return value becomes the tool result. */
export function action<S extends StandardSchemaV1>(
  description: string,
  schema: S,
  handler: (args: StandardSchemaInferOutput<S>) => unknown | Promise<unknown>,
): FunctionToolDef<S> {
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

/** Collect named client tools into a frozen registry (the key is the tool name). */
export function tools(map: Record<string, ClientToolDef>): ClientToolRegistry {
  return Object.freeze({ ...map });
}
