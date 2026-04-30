// SPDX-License-Identifier: MIT
import { Type } from '@angular/core';
import type { Spec, StateStore, ComputedFunction } from '@json-render/core';

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

export interface AngularRegistry {
  get(name: string): AngularComponentRenderer | undefined;
  names(): string[];
}

export interface RenderConfig {
  registry?: AngularRegistry;
  store?: StateStore;
  functions?: Record<string, ComputedFunction>;
  handlers?: Record<string, (params: Record<string, unknown>) => unknown | Promise<unknown>>;
  /** Signed license token from cacheplane.dev. Optional; omitted in dev. */
  license?: string;
  /**
   * @internal
   * Test-only env hint override. Not part of the stable API.
   */
  __licenseEnvHint?: { isNoncommercial: boolean };
  /**
   * @internal
   * Test-only public-key override. Defaults to the compile-time embedded
   * `LICENSE_PUBLIC_KEY`. Not part of the stable API.
   */
  __licensePublicKey?: Uint8Array;
}
