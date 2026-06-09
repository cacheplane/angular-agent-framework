// SPDX-License-Identifier: MIT
import { Type } from '@angular/core';
import type { Spec, StateStore, ComputedFunction } from '@json-render/core';
import type { StandardSchemaV1 } from './standard-schema';

export interface AngularComponentInputs {
  /** Two-way binding paths: prop name → absolute state path */
  bindings?: Record<string, string>;
  /** Emit a named event */
  emit: (event: string) => void;
  /** Whether the spec is currently streaming */
  loading?: boolean;
  /** Child element keys for recursive rendering */
  childKeys: string[];
  /** The full spec (for child resolution) */
  spec: Spec;
  /** Dynamic resolved props are spread as additional inputs */
  [key: string]: unknown;
}

export type AngularComponentRenderer = Type<unknown>;

/**
 * A view registry entry. Bare `Type` form is the legacy shape; the
 * object form lets consumers attach a per-component fallback that
 * mounts while any state-bound prop on the element is still
 * unresolved. The fallback is monotonic per element instance: once
 * the real component mounts, subsequent re-renders never revert to
 * fallback even if a prop later resolves to undefined.
 */
export interface RenderViewEntry {
  component: Type<unknown>;
  fallback?: Type<unknown>;
  /** Optional props contract for this component (Zod/Valibot/ArkType via
   * Standard Schema). Carried + exposed by the render lib but NOT enforced
   * on mount; consumers (e.g. client-tools) read it to advertise the
   * component to a model and to validate incoming props. */
  schema?: StandardSchemaV1;
  /** Optional human/model-facing description of what this component renders. */
  description?: string;
}

export interface AngularRegistry {
  get(name: string): AngularComponentRenderer | undefined;
  /**
   * Returns the configured fallback for a registered name, OR the
   * lib's default fallback if the entry omits one, OR undefined if
   * the name is not registered.
   */
  getFallback(name: string): AngularComponentRenderer | undefined;
  names(): string[];
}

export interface RenderConfig {
  registry?: AngularRegistry;
  store?: StateStore;
  functions?: Record<string, ComputedFunction>;
  handlers?: Record<string, (params: Record<string, unknown>) => unknown | Promise<unknown>>;
}
