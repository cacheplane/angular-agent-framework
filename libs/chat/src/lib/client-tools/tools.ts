// SPDX-License-Identifier: MIT
import type { Type } from '@angular/core';
import type { StandardSchemaV1, StandardSchemaInferOutput } from '@threadplane/render';
import type { ClientToolDef, FunctionToolDef, ViewToolDef, AskToolDef } from './tool-def';
import type { AcceptComponent } from './component-inputs';
export type { ViewProps } from './component-inputs';

/** Async function tool — its resolved return value becomes the tool result. */
export function action<S extends StandardSchemaV1, R>(
  description: string,
  schema: S,
  handler: (args: StandardSchemaInferOutput<S>) => R | Promise<R>,
): FunctionToolDef<S, R> {
  return { kind: 'function', description, schema, handler };
}

/** Render-only component tool — the model fills its props; auto-acknowledged.
 *  The component's signal inputs are checked against the schema's output type. */
export function view<S extends StandardSchemaV1, C>(
  description: string,
  schema: S,
  component: AcceptComponent<S, C>,
): ViewToolDef<S, C> {
  return { kind: 'view', description, schema, component: component as Type<C> };
}

/** Interactive (HITL) component tool — the value it emits becomes the result.
 *  The component's signal inputs are checked against the schema's output type. */
export function ask<S extends StandardSchemaV1, C>(
  description: string,
  schema: S,
  component: AcceptComponent<S, C>,
): AskToolDef<S, C> {
  return { kind: 'ask', description, schema, component: component as Type<C> };
}

/** Collect named client tools into a frozen registry (the key is the tool name).
 *  Generic + `const` over the map so per-tool types and literal keys survive. */
export function tools<const M extends Record<string, ClientToolDef>>(map: M): Readonly<M> {
  return Object.freeze({ ...map });
}
