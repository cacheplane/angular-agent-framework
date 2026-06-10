// SPDX-License-Identifier: MIT
import type { Type } from '@angular/core';
import type { StandardSchemaV1, StandardSchemaInferOutput } from '@threadplane/render';

/** A client tool the model can call; executed in the browser. */
export type ClientToolDef =
  | FunctionToolDef
  | ViewToolDef
  | AskToolDef;

export interface FunctionToolDef<S extends StandardSchemaV1 = StandardSchemaV1> {
  readonly kind: 'function';
  readonly description: string;
  readonly schema: S;
  readonly handler: (args: StandardSchemaInferOutput<S>) => unknown | Promise<unknown>;
}

export interface ViewToolDef {
  readonly kind: 'view';
  readonly description: string;
  readonly schema: StandardSchemaV1;
  readonly component: Type<unknown>;
}

export interface AskToolDef {
  readonly kind: 'ask';
  readonly description: string;
  readonly schema: StandardSchemaV1;
  readonly component: Type<unknown>;
}

/** A frozen, name-keyed registry of client tools. */
export type ClientToolRegistry = Readonly<Record<string, ClientToolDef>>;
