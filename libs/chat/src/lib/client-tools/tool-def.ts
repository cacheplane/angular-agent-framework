// SPDX-License-Identifier: MIT
import type { Type } from '@angular/core';
import type { StandardSchemaV1, StandardSchemaInferInput, StandardSchemaInferOutput } from '@threadplane/render';

export type { StandardSchemaV1, StandardSchemaInferInput, StandardSchemaInferOutput };

/** Runtime context passed to browser-executed function tool handlers. */
export interface FunctionToolHandlerContext {
  /** Aborts when the client tool execution should stop without resolving. */
  readonly signal: AbortSignal;
}

/** Precise authored function tool — what `action()` returns. Carries the schema
 *  `S` and the handler's resolved return type `R`. */
export interface FunctionToolDef<S extends StandardSchemaV1 = StandardSchemaV1, R = unknown> {
  readonly kind: 'function';
  readonly description: string;
  readonly schema: S;
  readonly handler: (
    args: StandardSchemaInferOutput<S>,
    context: FunctionToolHandlerContext,
  ) => R | Promise<R>;
}

/** Bivariant union member used only for registry storage/iteration. The handler
 *  param is `any` (NOT `never`): `any` is simultaneously a supertype any precise
 *  `FunctionToolDef<S,R>` is assignable to under `strictFunctionTypes`, AND
 *  callable by internal code that has narrowed by `kind` and parsed runtime args.
 *  A `never` param would satisfy the former but break the latter. */
export interface AnyFunctionToolDef {
  readonly kind: 'function';
  readonly description: string;
  readonly schema: StandardSchemaV1;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- bivariance escape hatch; see note above
  readonly handler: (args: any, context: FunctionToolHandlerContext) => unknown | Promise<unknown>;
}

export interface ViewToolDef<S extends StandardSchemaV1 = StandardSchemaV1, C = unknown> {
  readonly kind: 'view';
  readonly description: string;
  readonly schema: S;
  readonly component: Type<C>;
}

export interface AskToolDef<S extends StandardSchemaV1 = StandardSchemaV1, C = unknown> {
  readonly kind: 'ask';
  readonly description: string;
  readonly schema: S;
  readonly component: Type<C>;
}

/** A client tool the model can call; executed in the browser. */
export type ClientToolDef =
  | AnyFunctionToolDef
  | ViewToolDef
  | AskToolDef;

/** A frozen, name-keyed registry of client tools. */
export type ClientToolRegistry = Readonly<Record<string, ClientToolDef>>;
