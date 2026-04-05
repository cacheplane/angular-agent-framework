// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Type } from '@angular/core';
import type { Spec, StateStore, ComputedFunction } from '@json-render/core';

export interface AngularComponentInputs {
  props: Record<string, unknown>;
  bindings?: Record<string, string>;
  emit: (event: string) => void;
  loading?: boolean;
  childKeys: string[];
  spec: Spec;
}

export type AngularComponentRenderer = Type<unknown>;

export interface AngularRegistry {
  get(name: string): AngularComponentRenderer | undefined;
  names(): string[];
}

export interface RenderConfig {
  registry?: AngularRegistry;
  store?: StateStore;
  functions?: Record<string, ComputedFunction>;
  handlers?: Record<string, (params: Record<string, unknown>) => unknown | Promise<unknown>>;
}
